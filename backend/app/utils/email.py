"""Email utility with Gmail SMTP and Brevo REST API failover."""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx

from app.config import settings

logger = logging.getLogger("app.email")


def get_otp_template(otp: str, user_name: str) -> str:
    """Generate beautiful HTML email for OTP codes."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; }}
            .header {{ background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
            .content {{ padding: 40px 30px; line-height: 1.6; }}
            .content h2 {{ font-size: 20px; color: #1e1b4b; margin-top: 0; }}
            .otp-container {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
            .otp-code {{ font-size: 36px; font-weight: 800; color: #166534; letter-spacing: 6px; margin: 0; }}
            .footer {{ background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
            .footer p {{ margin: 5px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>AcadSync Hub</h1>
            </div>
            <div class="content">
                <h2>Hello {user_name},</h2>
                <p>We received a request to reset your password. Use the verification code below to authorize the operation. This code is valid for 10 minutes.</p>
                <div class="otp-container">
                    <div class="otp-code">{otp}</div>
                </div>
                <p>If you did not request a password reset, please ignore this email or secure your account.</p>
            </div>
            <div class="footer">
                <p>Sent by AcadSync Campus Communication Hub</p>
                <p>&copy; 2026 AcadSync. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_message_template(sender_name: str, subject: str, snippet: str, recipient_name: str) -> str:
    """Generate beautiful HTML email for message alerts."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; }}
            .header {{ background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
            .content {{ padding: 40px 30px; line-height: 1.6; }}
            .content h2 {{ font-size: 20px; color: #1e1b4b; margin-top: 0; }}
            .message-preview {{ background: #fafafa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }}
            .message-sender {{ font-weight: 600; color: #4b5563; margin-bottom: 5px; }}
            .message-subject {{ font-style: italic; color: #1f2937; font-weight: 500; margin-bottom: 8px; }}
            .message-snippet {{ color: #4b5563; }}
            .btn-action {{ display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 20px; text-align: center; }}
            .footer {{ background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
            .footer p {{ margin: 5px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>AcadSync Hub</h1>
            </div>
            <div class="content">
                <h2>Hello {recipient_name},</h2>
                <p>You have received a new message in your AcadSync Inbox. Here is a preview of the message details:</p>
                <div class="message-preview">
                    <div class="message-sender">Sender: {sender_name}</div>
                    <div class="message-subject">Subject: {subject}</div>
                    <div class="message-snippet">"{snippet}"</div>
                </div>
                <p>To view the full conversation and reply, click the link below to open your inbox.</p>
                <div style="text-align: center;">
                    <a href="http://localhost:5173/dashboard" class="btn-action" style="color: #ffffff;">Go to Inbox</a>
                </div>
            </div>
            <div class="footer">
                <p>Sent by AcadSync Campus Communication Hub</p>
                <p>&copy; 2026 AcadSync. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """


def send_system_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send system email with Gmail (SMTP) and Brevo REST API, using the active provider first and falling back to the other."""
    if not to_email:
        logger.error("Recipient email is empty, cannot send email.")
        return False

    # Determine order based on preferred provider
    primary = settings.EMAIL_PROVIDER.lower() if settings.EMAIL_PROVIDER else "gmail"
    providers = ["gmail", "brevo"] if primary == "gmail" else ["brevo", "gmail"]

    for provider in providers:
        if provider == "gmail":
            gmail_ready = bool(settings.GMAIL_EMAIL and settings.GMAIL_APP_PASSWORD)
            if gmail_ready:
                try:
                    logger.info(f"Attempting to send email to {to_email} via Gmail SMTP...")
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = settings.GMAIL_EMAIL
                    msg["To"] = to_email
                    
                    part = MIMEText(html_body, "html")
                    msg.attach(part)
                    
                    # Connect via SMTP_SSL for port 465, or SMTP with STARTTLS for port 587
                    if settings.GMAIL_SMTP_PORT == 465:
                        with smtplib.SMTP_SSL(settings.GMAIL_SMTP_HOST, settings.GMAIL_SMTP_PORT, timeout=10) as server:
                            server.login(settings.GMAIL_EMAIL, settings.GMAIL_APP_PASSWORD)
                            server.sendmail(settings.GMAIL_EMAIL, to_email, msg.as_string())
                    else:
                        with smtplib.SMTP(settings.GMAIL_SMTP_HOST, settings.GMAIL_SMTP_PORT, timeout=10) as server:
                            server.starttls()
                            server.login(settings.GMAIL_EMAIL, settings.GMAIL_APP_PASSWORD)
                            server.sendmail(settings.GMAIL_EMAIL, to_email, msg.as_string())
                    
                    logger.info(f"Email sent successfully to {to_email} via Gmail SMTP.")
                    return True
                except Exception as e:
                    logger.warning(f"Gmail SMTP failed: {e}. Trying fallback if available...")
            else:
                logger.info("Gmail SMTP is not configured (GMAIL_EMAIL or GMAIL_APP_PASSWORD missing).")

        elif provider == "brevo":
            if settings.BREVO_API_KEY:
                try:
                    logger.info(f"Attempting to send email to {to_email} via Brevo REST API...")
                    headers = {
                        "accept": "application/json",
                        "api-key": settings.BREVO_API_KEY,
                        "content-type": "application/json",
                    }
                    payload = {
                        "sender": {
                            "name": settings.BREVO_SENDER_NAME,
                            "email": settings.BREVO_SENDER_EMAIL
                        },
                        "to": [
                            {
                                "email": to_email
                            }
                        ],
                        "subject": subject,
                        "htmlContent": html_body
                    }
                    
                    with httpx.Client(timeout=10) as client:
                        response = client.post(
                            "https://api.brevo.com/v3/smtp/email",
                            json=payload,
                            headers=headers
                        )
                        response.raise_for_status()
                    logger.info(f"Email sent successfully to {to_email} via Brevo REST API.")
                    return True
                except Exception as e:
                    logger.warning(f"Brevo REST API failed: {e}. Trying fallback if available...")
            else:
                logger.info("Brevo REST API is not configured (BREVO_API_KEY missing).")

    # Fallback to Demo Mode Logging
    logger.warning("No functioning email configurations are available or all failed.")
    logger.info(f"--- DEMO EMAIL LOG ---")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Body: {html_body[:200]}...")
    logger.info(f"----------------------")
    return False
