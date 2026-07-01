import json
import logging
from typing import Callable, Optional

from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> Optional[OpenAI]:
    global _client
    if not settings.openai_api_key:
        return None
    if _client is None:
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def run_assistant(
    system_prompt: str,
    history: list[dict],
    tools: list[dict],
    tool_executor: Callable[[str, dict], dict],
    max_turns: int = 5,
) -> str:
    """Run an OpenAI tool-calling chat loop and return the assistant's final text reply."""
    client = _get_client()
    if not client:
        return "Sorry, our AI assistant is currently unavailable. Please call us directly."

    messages = [{"role": "system", "content": system_prompt}, *history]

    for _ in range(max_turns):
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        choice = response.choices[0].message

        if not choice.tool_calls:
            return choice.content or "Sorry, I didn't quite understand that. Could you rephrase?"

        messages.append({
            "role": "assistant",
            "content": choice.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in choice.tool_calls
            ],
        })

        for tool_call in choice.tool_calls:
            try:
                args = json.loads(tool_call.function.arguments or "{}")
                result = tool_executor(tool_call.function.name, args)
            except Exception as e:
                logger.error(f"Tool execution failed for {tool_call.function.name}: {e}")
                result = {"error": str(e)}
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, default=str),
            })

    logger.warning("WhatsApp assistant hit max_turns without a final reply")
    return "I'm having trouble completing that request right now. Please call us directly to confirm."
