"""Generates docs/META_WHATSAPP_CLIENT_GUIDE.pdf - a non-technical, step-by-step guide
for a business owner to set up their own Meta WhatsApp Business Cloud API credentials
and connect them in the BookingAI dashboard. Re-run this script after editing CONTENT
below to regenerate the PDF.
"""
import os
from fpdf import FPDF

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "META_WHATSAPP_CLIENT_GUIDE.pdf")

MARGIN = 18
PAGE_WIDTH = 210 - 2 * MARGIN  # A4 minus margins


class GuidePDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, "Connecting Your WhatsApp Business Number", align="L")
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def title_page(pdf: GuidePDF):
    pdf.add_page()
    pdf.set_y(80)
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(20, 20, 20)
    pdf.multi_cell(PAGE_WIDTH, 14, "Connecting Your WhatsApp\nBusiness Number", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(PAGE_WIDTH, 8, "A step-by-step guide to setting up Meta WhatsApp Business\nCloud API and connecting it to your BookingAI dashboard.", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(PAGE_WIDTH, 7, "Estimated time: 30-45 minutes\nWhat you'll need: a Facebook account, your business phone number,\nand access to receive an SMS/call on that number for verification.", align="C", new_x="LMARGIN", new_y="NEXT")


def h1(pdf: GuidePDF, text: str):
    pdf.add_page()
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 20, 20)
    pdf.multi_cell(PAGE_WIDTH, 10, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(MARGIN, pdf.get_y(), MARGIN + PAGE_WIDTH, pdf.get_y())
    pdf.ln(6)


def h2(pdf: GuidePDF, text: str):
    pdf.ln(3)
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(PAGE_WIDTH, 8, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)


def body(pdf: GuidePDF, text: str):
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(PAGE_WIDTH, 6.5, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def step(pdf: GuidePDF, number, text: str):
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(8, 6.5, f"{number}.", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(PAGE_WIDTH - 8, 6.5, text, new_x="LMARGIN", new_y="NEXT")


def bullet(pdf: GuidePDF, text: str):
    pdf.set_x(MARGIN)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(6, 6.5, "-", new_x="RIGHT", new_y="TOP")
    pdf.multi_cell(PAGE_WIDTH - 6, 6.5, text, new_x="LMARGIN", new_y="NEXT")


def note(pdf: GuidePDF, text: str):
    pdf.ln(2)
    pdf.set_x(MARGIN)
    pdf.set_fill_color(245, 245, 240)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(110, 90, 20)
    pdf.multi_cell(PAGE_WIDTH, 6.5, "NOTE: " + text, fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def build():
    pdf = GuidePDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(MARGIN, MARGIN, MARGIN)

    title_page(pdf)

    # Overview
    h1(pdf, "What This Is For")
    body(pdf,
         "To send and receive WhatsApp messages automatically through your BookingAI dashboard "
         "(appointment confirmations, reminders, and an AI assistant that can chat with your "
         "customers), your WhatsApp Business number needs to be connected to Meta's WhatsApp "
         "Business Cloud API.")
    body(pdf,
         "This guide walks you through creating that connection yourself. It takes about "
         "30-45 minutes the first time. If you'd rather not do this yourself, see the "
         "'Need Help?' section at the end - your developer can complete this for you remotely.")
    body(pdf, "By the end of this guide, you will have 4 pieces of information to paste into "
              "the 'Connect WhatsApp' form in your dashboard:")
    bullet(pdf, "Phone Number ID")
    bullet(pdf, "WhatsApp Business Account ID (WABA ID)")
    bullet(pdf, "Access Token")
    bullet(pdf, "Display phone number (optional)")

    # Step 1
    h1(pdf, "Step 1: Create a Meta Business Account")
    body(pdf, "If you don't already have one, you need a Meta Business Manager account - this "
              "is Meta's hub for managing business tools including WhatsApp.")
    step(pdf, 1, "Go to business.facebook.com")
    step(pdf, 2, "Log in with your personal Facebook account, or create one if you don't have one.")
    step(pdf, 3, "Click 'Create an Account' and follow the prompts: enter your business name, "
                 "your name, and your business email address.")
    note(pdf, "Use an email address you check regularly - Meta will send important verification "
              "and approval notifications here.")

    # Step 2
    h1(pdf, "Step 2: Create a Meta App")
    body(pdf, "An 'app' is how Meta connects your business to the WhatsApp API.")
    step(pdf, 1, "Go to developers.facebook.com/apps")
    step(pdf, 2, "Click 'Create App'")
    step(pdf, 3, "Select app type: 'Business'")
    step(pdf, 4, "Enter an app name (e.g. your business name) and select your Business Account "
                 "from Step 1")
    step(pdf, 5, "Click 'Create App'")

    # Step 3
    h1(pdf, "Step 3: Add the WhatsApp Product")
    step(pdf, 1, "On your new app's dashboard, find 'WhatsApp' in the list of products and "
                 "click 'Set up'")
    step(pdf, 2, "You'll land on the WhatsApp 'Quickstart' / 'API Setup' page")
    body(pdf, "Meta automatically gives you a free test number here. You can use this to send "
              "test messages to your own phone, but real customers will not receive messages "
              "from it. We'll set up your real number in Step 5.")

    # Step 4
    h1(pdf, "Step 4: Find Your Phone Number ID and WABA ID")
    body(pdf, "Still on the API Setup page:")
    step(pdf, 1, "Look for a box labeled 'Phone number ID' - copy this number")
    step(pdf, 2, "Look for a box labeled 'WhatsApp Business Account ID' - copy this number")
    note(pdf, "Keep these somewhere safe (a notes app or document) - you'll paste both into the "
              "dashboard form at the end of this guide.")

    # Step 5
    h1(pdf, "Step 5: Connect Your Real Business Phone Number")
    body(pdf, "By default, Meta gives you a free test number. To message real customers, you "
              "need to add your own business phone number.")
    step(pdf, 1, "On the API Setup page, find the 'From' dropdown and select "
                 "'Add phone number'")
    step(pdf, 2, "Enter your business phone number")
    step(pdf, 3, "Choose how to verify: text message or phone call")
    step(pdf, 4, "Enter the verification code you receive")
    note(pdf, "If you see a message saying the number is 'already registered to a WhatsApp "
              "account', it means that number is currently active on the regular WhatsApp app "
              "or WhatsApp Business app on a phone. You'll need to delete the WhatsApp account "
              "on that phone first (Settings > Account > Delete my account), wait a few "
              "minutes, then try again. After this, that phone can no longer use WhatsApp - "
              "all messaging will go through the new system instead.")
    body(pdf, "Once verified, go back to Step 4 and re-copy the Phone Number ID - it will now "
              "be different, matching your real number instead of the test number.")

    # Step 6
    h1(pdf, "Step 6: Generate a Permanent Access Token")
    body(pdf, "The token shown on the API Setup page expires after 24 hours. You need a "
              "permanent one.")
    step(pdf, 1, "Go to business.facebook.com > Settings > Users > System Users")
    step(pdf, 2, "Click 'Add' and create a new system user (name it anything, e.g. "
                 "'WhatsApp API User'); set its role to 'Admin'")
    step(pdf, 3, "Click on the new system user, then 'Add Assets'")
    step(pdf, 4, "Select your App from Step 2 and your WhatsApp Account, and give both "
                 "'Full control'")
    step(pdf, 5, "Click 'Generate New Token'")
    step(pdf, 6, "Select your app, then check the boxes for 'whatsapp_business_messaging' and "
                 "'whatsapp_business_management'")
    step(pdf, 7, "Set expiration to 'Never'")
    step(pdf, 8, "Click 'Generate Token' and copy it immediately")
    note(pdf, "This token will only be shown once. If you lose it, you'll need to generate a "
              "new one. Treat it like a password - do not share it publicly.")

    # Step 7
    h1(pdf, "Step 7: Add a Privacy Policy and Go Live")
    body(pdf, "Meta requires every business to have a published privacy policy before your "
              "app can send messages to real customers (not just test numbers).")
    step(pdf, 1, "If you don't have a privacy policy page, ask your developer to provide one, "
                 "or generate one for free at privacypolicygenerator.info")
    step(pdf, 2, "On your app dashboard, go to 'App Settings' > 'Basic'")
    step(pdf, 3, "Paste your privacy policy URL into the 'Privacy Policy URL' field and save")
    step(pdf, 4, "At the top of the App Dashboard, switch the toggle from 'Development' to "
                 "'Live'")

    # Step 8
    h1(pdf, "Step 8: Add a Payment Method")
    body(pdf, "WhatsApp charges a small fee per conversation once you're live (not per "
              "message). Without a payment method on file, Meta will eventually block sending.")
    step(pdf, 1, "Go to business.facebook.com > WhatsApp Manager > Payment Configuration")
    step(pdf, 2, "Add a credit/debit card under your country's billing section")

    # Step 9
    h1(pdf, "Step 9: Enter Your Details in the Dashboard")
    body(pdf, "You now have everything you need. Go to your BookingAI dashboard:")
    step(pdf, 1, "Dashboard > Locations > select your location > 'Connect WhatsApp'")
    step(pdf, 2, "Phone Number ID: paste the value from Step 4 (the one matching your real "
                 "number, not the test number)")
    step(pdf, 3, "WABA ID: paste the WhatsApp Business Account ID from Step 4")
    step(pdf, 4, "Access Token: paste the permanent token from Step 6")
    step(pdf, 5, "Display phone (optional): your business number in international format, "
                 "e.g. +91 98765 43210")
    step(pdf, 6, "Click 'Connect WhatsApp'")
    body(pdf, "Your location is now connected. Test it by sending a WhatsApp message to your "
              "business number from a personal phone.")

    # Step 10
    h1(pdf, "Step 10: Complete Business Verification (Recommended)")
    body(pdf, "This is different from the phone number verification in Step 5. Step 5 only "
              "proved you control the phone number. Business Verification proves your company "
              "is a real, legally registered business - and it controls how many customers "
              "you're allowed to message per day.")
    body(pdf, "Every new WhatsApp account starts with a small daily messaging limit. That limit "
              "grows automatically over time, but grows faster and higher if your business is "
              "verified. If you skip this, you may hit a wall later where the system can't send "
              "any more messages until the next day.")
    step(pdf, 1, "Go to business.facebook.com > Settings > Business Info (or Security Center)")
    step(pdf, 2, "Click 'Start Verification'")
    step(pdf, 3, "Enter your legal business name and address exactly as they appear on your "
                 "official documents - small mismatches are the most common reason this gets "
                 "rejected")
    step(pdf, 4, "Upload one document: a GST certificate, Udyam/MSME registration certificate, "
                 "Certificate of Incorporation, or a recent utility bill/bank statement showing "
                 "your business name and address")
    step(pdf, 5, "Submit and wait - this can take anywhere from a few hours to several days")
    note(pdf, "Start this early. Don't wait until you're already sending a lot of messages and "
              "hit the daily limit - by then you'll be stuck waiting for approval before you "
              "can send any more.")

    # Step 11
    h1(pdf, "Step 11: Get Your Display Name Approved")
    body(pdf, "The name your customers actually see on WhatsApp (e.g. your business name) goes "
              "through its own separate review - this is not automatic just because you set up "
              "the number.")
    step(pdf, 1, "In WhatsApp Manager, go to your phone number's Profile settings")
    step(pdf, 2, "Set the display name to your real, recognizable business name")
    step(pdf, 3, "Submit for review - this usually takes 24-48 hours")
    note(pdf, "Until this is approved, customers may see a generic placeholder or your raw "
              "phone number instead of your business name when you message them.")

    # Templates note
    h1(pdf, "About Message Templates")
    body(pdf, "Separately from the steps above, any message your business sends FIRST (before "
              "a customer messages you) - such as appointment reminders, membership renewal "
              "follow-ups, or first contact with a new lead - must use a pre-approved 'message "
              "template'. This is a WhatsApp rule for every business, not specific to this "
              "system.")
    h2(pdf, "Two categories you need to know about")
    body(pdf, "Meta sorts every template into a category, and gets strict about which category "
              "fits:")
    bullet(pdf, "Utility - factual, transactional messages with no sales pitch. Appointment "
                "confirmations and reminders to people who already booked something belong "
                "here. No offers, no discounts, no persuasive wording allowed - even one "
                "promotional phrase can get the whole template moved into the stricter, more "
                "expensive Marketing category.")
    bullet(pdf, "Marketing - anything promotional, or any message reaching out to someone who "
                "hasn't booked yet (new leads, win-back messages, special offers). The 4-step "
                "WhatsApp sequence sent to new leads falls here.")
    body(pdf, "Templates are created and submitted for approval at:")
    bullet(pdf, "business.facebook.com > WhatsApp Manager > Message Templates > Create Template")
    h2(pdf, "Tips to get templates approved on the first try")
    bullet(pdf, "Keep Utility templates strictly factual - name, service, date/time, nothing "
                "promotional")
    bullet(pdf, "Proofread for spelling and grammar before submitting")
    bullet(pdf, "Avoid shortened links (bit.ly, tinyurl) - use the full web address or none")
    bullet(pdf, "Number your placeholders in order without skipping: {{1}}, {{2}}, {{3}}")
    bullet(pdf, "Don't try to label a promotional message as Utility to save money - Meta's "
                "review catches this and can flag your account")
    body(pdf, "Approval is usually automatic within a few minutes for clean Utility templates; "
              "Marketing templates are reviewed more strictly and can take longer. Your "
              "developer can prepare the exact template wording (in English, Hindi, and Tamil) "
              "and submit these for you - this is usually faster than doing it yourself the "
              "first time, since the wording has to match exactly what the system sends.")
    body(pdf, "Once a customer replies to any message from you, your AI assistant can have a "
              "completely free-form conversation with them for 24 hours - no template needed "
              "for that part.")

    # Quality / good standing
    h1(pdf, "Keeping Your WhatsApp Number in Good Standing")
    body(pdf, "Getting connected isn't the end of the story - Meta continuously scores your "
              "number, and a bad score can shrink your daily messaging limit or get the number "
              "restricted.")
    bullet(pdf, "Quality rating (High / Medium / Low) - visible in WhatsApp Manager. Driven by "
                "how often people block you, report you as spam, or ignore your messages.")
    bullet(pdf, "Every block or 'report as spam' counts against you - this is why it matters "
                "that the system stops messaging someone the moment they reply STOP or similar, "
                "which it already does automatically.")
    bullet(pdf, "Don't increase how often leads are messaged beyond the built-in 4-step "
                "sequence - messaging people too often with low reply rates is what drags the "
                "quality score down.")
    note(pdf, "If your quality rating drops to Low for a sustained period, Meta can reduce your "
              "messaging limit even if you completed Business Verification. Treat customer "
              "opt-outs and complaints seriously and address them quickly.")

    # Help section
    h1(pdf, "Need Help?")
    body(pdf, "If any of these steps feel too technical, or you run into an error message you "
              "don't understand, you don't have to do this alone. Your developer can:")
    bullet(pdf, "Complete this entire setup remotely on a screen-share call with you")
    bullet(pdf, "Prepare and submit your message templates for approval")
    bullet(pdf, "Troubleshoot any verification or 'Live mode' errors from Meta")
    body(pdf, "")
    body(pdf, "Contact your developer: ___________________________")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    pdf.output(OUTPUT_PATH)
    print(f"PDF written to {os.path.abspath(OUTPUT_PATH)}")


if __name__ == "__main__":
    build()
