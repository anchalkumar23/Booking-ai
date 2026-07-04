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
         "Your developer has already created the Meta app. What remains is connecting your real "
         "business phone number and generating the credentials. This guide walks through exactly "
         "what you will see in the Meta dashboard - each step matches the screens in front of you.")
    body(pdf, "By the end you will have 4 pieces of information to paste into the 'Connect "
              "WhatsApp' form in your BookingAI dashboard:")
    bullet(pdf, "Phone Number ID")
    bullet(pdf, "WhatsApp Business Account ID (WABA ID)")
    bullet(pdf, "Permanent Access Token")
    bullet(pdf, "Display phone number (optional)")
    note(pdf, "If any of these steps feel too technical, your developer can complete all of this "
              "for you on a screen-share call. See 'Need Help?' at the end of this guide.")

    # Step 1 - Production Setup
    h1(pdf, "Step 1: Open Production Setup in the Meta Dashboard")
    body(pdf,
         "Go to developers.facebook.com/apps and open the BookingAI app (your developer will "
         "share access with you, or they may do this step themselves).")
    body(pdf,
         "In the left sidebar under WhatsApp, you will see three steps listed: "
         "'Step 1. Try it out', 'Step 2. Production setup', and 'Step 3. Business verification'. "
         "Step 1 (Try it out) uses a test number that cannot message real customers - skip it. "
         "Click 'Step 2. Production setup' or click 'Continue' at the bottom of the page.")
    note(pdf,
         "The app may still show 'App Mode: Development' at the top. You will switch it to "
         "Live in Step 4 of this guide. Do not worry about it for now.")

    # Step 2 - Add phone number
    h1(pdf, "Step 2: Add Your Real Business Phone Number")
    body(pdf,
         "Inside 'Step 2. Production setup' you will see a section to add a phone number. "
         "This is where you register the number your customers will message.")
    step(pdf, 1, "Click 'Add phone number'")
    step(pdf, 2, "Enter a display name for your business (e.g. 'Slam Fitness Washermenpet') "
                 "- this is what customers will see in WhatsApp")
    step(pdf, 3, "Select your business category")
    step(pdf, 4, "Enter your business phone number in international format (e.g. +91 96262 53222)")
    step(pdf, 5, "Choose verification method: Text message (SMS) or Phone call")
    step(pdf, 6, "Enter the OTP code you receive on that number")
    note(pdf,
         "If you see an error saying the number is already registered to a WhatsApp account, "
         "the number is active on the WhatsApp or WhatsApp Business app on a phone. "
         "You have two options: (a) delete the WhatsApp account on that phone first via "
         "Settings > Account > Delete my account, wait a few minutes, then try again - after "
         "this the phone can no longer use WhatsApp; or (b) during the registration flow, "
         "look for a 'Migrate from existing WhatsApp' option which moves the number without "
         "deleting chat history.")

    # Step 3 - Get IDs
    h1(pdf, "Step 3: Copy Your Phone Number ID and WABA ID")
    body(pdf,
         "After your number is verified, the Production Setup page will show your credentials. "
         "You need two IDs from this page.")
    step(pdf, 1, "Look for a field labeled 'Phone number ID' - it is a long number. Copy it "
                 "and save it in a notes app.")
    step(pdf, 2, "Look for a field labeled 'WhatsApp Business Account ID' (sometimes shown as "
                 "'WABA ID') - copy this too.")
    note(pdf,
         "These IDs are specific to your real number, not the test number. Make sure the "
         "number shown on the page matches your business phone number before copying.")

    # Step 4 - Permanent token
    h1(pdf, "Step 4: Generate a Permanent Access Token")
    body(pdf,
         "The page shows a temporary token that expires after 24 hours. You need a permanent "
         "one that never expires. This is generated through Meta Business Manager, not the "
         "developer dashboard.")
    step(pdf, 1, "Open a new tab and go to business.facebook.com")
    step(pdf, 2, "Click the Settings icon (gear) for your Business Portfolio")
    step(pdf, 3, "Go to Users > System Users in the left menu")
    step(pdf, 4, "Click 'Add' to create a new system user. Name it anything (e.g. "
                 "'WhatsApp API User') and set the role to 'Admin'. Click 'Create system user'.")
    step(pdf, 5, "Click on the new system user, then click 'Add Assets'")
    step(pdf, 6, "Under 'Apps', select the BookingAI app and enable 'Full control'")
    step(pdf, 7, "Under 'WhatsApp accounts', select your WhatsApp Business Account and enable "
                 "'Full control'. Click 'Save changes'.")
    step(pdf, 8, "Back on the system user, click 'Generate new token'")
    step(pdf, 9, "Select the BookingAI app from the dropdown")
    step(pdf, 10, "Set token expiration to 'Never'")
    step(pdf, 11, "Tick both permissions: 'whatsapp_business_messaging' and "
                  "'whatsapp_business_management'")
    step(pdf, 12, "Click 'Generate token' and copy it immediately")
    note(pdf,
         "This token is shown only once. Copy it now and keep it somewhere safe. "
         "If you lose it you will need to generate a new one. Treat it like a password - "
         "never share it publicly or send it over email.")

    # Step 5 - Privacy Policy + Go Live
    h1(pdf, "Step 5: Add a Privacy Policy and Switch to Live Mode")
    body(pdf,
         "Meta requires a published privacy policy URL before your app can send messages to "
         "real customers. If you do not have one, your developer can provide the URL.")
    step(pdf, 1, "In the Meta App Dashboard (developers.facebook.com/apps), go to "
                 "'App settings' > 'Basic' in the left sidebar")
    step(pdf, 2, "Find the 'Privacy Policy URL' field and paste your privacy policy web address")
    step(pdf, 3, "Scroll down and click 'Save changes'")
    step(pdf, 4, "At the very top of the App Dashboard, find the toggle that says "
                 "'App Mode: Development' and switch it to 'Live'")
    note(pdf,
         "Until the app is in Live mode, messages can only be sent to a small list of "
         "manually approved test numbers. Switch to Live before testing with real customers.")

    # Step 6 - Payment
    h1(pdf, "Step 6: Add a Payment Method")
    body(pdf,
         "Meta charges a small fee per outbound message (reminders, follow-ups sent to "
         "customers before they message you). For India, this is typically less than "
         "one rupee per message. Without a payment method, Meta will stop outbound "
         "sending after the free trial period ends.")
    step(pdf, 1, "Go to business.facebook.com")
    step(pdf, 2, "In the left menu, go to WhatsApp Manager")
    step(pdf, 3, "Look for 'Payment Configuration' or 'Billing' in the WhatsApp Manager menu")
    step(pdf, 4, "Add a credit or debit card")
    note(pdf,
         "Replies sent within 24 hours of a customer messaging you are free. Only messages "
         "your business sends first (reminders, renewal follow-ups, lead outreach) carry a fee.")

    # Step 7 - Enter in dashboard
    h1(pdf, "Step 7: Enter Your Credentials in the BookingAI Dashboard")
    body(pdf, "You now have all 3 required pieces. Go to your BookingAI dashboard:")
    step(pdf, 1, "Navigate to Dashboard > Locations")
    step(pdf, 2, "Find the location you want to connect and click 'Connect WhatsApp'")
    step(pdf, 3, "Phone Number ID: paste the number you copied in Step 3")
    step(pdf, 4, "WABA ID: paste the WhatsApp Business Account ID from Step 3")
    step(pdf, 5, "Access Token: paste the permanent token from Step 4")
    step(pdf, 6, "Display phone (optional): your number in international format, "
                 "e.g. +91 96262 53222")
    step(pdf, 7, "Click 'Connect WhatsApp'")
    body(pdf,
         "The location now shows as 'Connected'. Test it by sending a WhatsApp message "
         "from a personal phone to your business number - you should get an AI reply within "
         "a few seconds.")

    # Step 8 - Business Verification
    h1(pdf, "Step 8: Complete Business Verification (Recommended)")
    body(pdf,
         "In the Meta App Dashboard left sidebar under WhatsApp, you will see "
         "'Step 3. Business verification'. This is separate from the phone number OTP you "
         "did earlier. This step proves to Meta that your business is a real, legally "
         "registered entity - and it directly controls how many customers you can message "
         "per day.")
    body(pdf,
         "Every new WhatsApp account starts with a limit of around 250 conversations per "
         "day. Completing Business Verification increases that limit significantly and "
         "allows it to grow further over time. Skip it now and you may hit a wall mid-day "
         "where no more messages can be sent until the next day.")
    step(pdf, 1, "Click 'Step 3. Business verification' in the Meta App Dashboard sidebar, "
                 "or go to business.facebook.com > Settings > Business info > Start verification")
    step(pdf, 2, "Enter your legal business name and registered address exactly as they appear "
                 "on your official documents - even small mismatches cause rejection")
    step(pdf, 3, "Upload one supporting document. Accepted in India:")
    bullet(pdf, "GST Registration Certificate (most commonly accepted and fastest)")
    bullet(pdf, "Udyam / MSME Registration Certificate")
    bullet(pdf, "Certificate of Incorporation")
    bullet(pdf, "Recent utility bill or bank statement showing your business name and address")
    step(pdf, 4, "Submit and wait. This usually takes a few hours to a few days.")
    note(pdf,
         "Start this as early as possible, ideally the same day you go live. "
         "Do not wait until you have already hit a messaging limit.")

    # Step 9 - Display Name
    h1(pdf, "Step 9: Get Your Display Name Approved")
    body(pdf,
         "The name customers see on WhatsApp when you message them (your business name) "
         "goes through its own separate review. It is not automatic.")
    step(pdf, 1, "Go to business.facebook.com > WhatsApp Manager")
    step(pdf, 2, "Click on your phone number, then go to 'Profile'")
    step(pdf, 3, "Set your display name to your real business name as customers know it")
    step(pdf, 4, "Click 'Submit for review' - this usually takes 24 to 48 hours")
    note(pdf,
         "Until this is approved, customers may see a generic label or your raw phone "
         "number when you message them. Submit this on the same day you go live.")

    # Templates
    h1(pdf, "About Message Templates")
    body(pdf,
         "Any message your business sends FIRST - before a customer has messaged you - "
         "must use a pre-approved message template. This covers appointment reminders, "
         "membership renewal follow-ups, and any outreach to new leads. "
         "Once a customer replies to you, your AI assistant can chat freely for 24 hours "
         "without any template.")
    h2(pdf, "Two categories you need to know")
    bullet(pdf,
           "Utility - factual, transactional messages only. Appointment confirmations and "
           "reminders to people who already booked belong here. No offers, discounts, or "
           "persuasive phrases allowed - even one promotional sentence gets the whole "
           "template reclassified into the more expensive Marketing category.")
    bullet(pdf,
           "Marketing - any promotional content, or outreach to someone who has not booked "
           "yet (new leads, win-back messages, special offers). The lead outreach sequence "
           "falls here.")
    body(pdf, "Templates are created at:")
    bullet(pdf, "business.facebook.com > WhatsApp Manager > Message Templates > Create Template")
    h2(pdf, "Tips to get approved on the first try")
    bullet(pdf, "Keep Utility templates factual only: name, service, date, time - nothing else")
    bullet(pdf, "Check spelling before submitting - errors cause rejection")
    bullet(pdf, "No shortened links (bit.ly etc.) - use the full URL or none at all")
    bullet(pdf, "Number variables in order: {{1}}, {{2}}, {{3}} - no gaps")
    bullet(pdf, "Do not label a promotional message as Utility - Meta catches this")
    body(pdf,
         "Your developer can prepare all template wording in English, Hindi, and Tamil "
         "and submit them for you. This is usually faster than doing it yourself the first "
         "time since the exact wording must match what the system sends.")

    # Quality rating
    h1(pdf, "Keeping Your WhatsApp Number in Good Standing")
    body(pdf,
         "Meta continuously scores every business number. A poor score can reduce your "
         "daily messaging limit or restrict the number entirely.")
    bullet(pdf,
           "Quality rating (High / Medium / Low) - visible in WhatsApp Manager. Goes down "
           "when customers block you or mark your messages as spam.")
    bullet(pdf,
           "The system automatically stops messaging anyone the moment they reply STOP, "
           "'not interested', or similar - the most important protection against score drops.")
    bullet(pdf,
           "Do not send messages to the same leads repeatedly beyond the built-in sequence.")
    note(pdf,
         "If your rating drops to Low for a sustained period, Meta can reduce your limit "
         "even if you completed Business Verification. Address opt-outs quickly.")

    # Help
    h1(pdf, "Need Help?")
    body(pdf,
         "If any step is unclear or you run into an error message, your developer can "
         "complete this entire setup remotely on a screen-share call. You just need to be "
         "present to receive the OTP on your business phone number.")
    bullet(pdf, "Complete Steps 1-7 on a screen-share call (approx. 30-45 minutes)")
    bullet(pdf, "Prepare and submit all message templates for approval")
    bullet(pdf, "Handle Business Verification if your documents are ready")
    bullet(pdf, "Troubleshoot any errors from Meta")
    pdf.ln(6)
    body(pdf, "Contact your developer: ___________________________")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    pdf.output(OUTPUT_PATH)
    print(f"PDF written to {os.path.abspath(OUTPUT_PATH)}")


if __name__ == "__main__":
    build()
