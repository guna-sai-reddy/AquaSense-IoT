"""AquaSense-IoT Email Delivery & Notification Service.

Provides secure email dispatching for:
1. One-Time Password (OTP) verification for secure password reset.
2. Administrative broadcasts and farm advisories to users' personal email addresses.
Supports live SMTP delivery (STARTTLS / SSL) with automatic development preview fallback.
"""

from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory log of dispatched emails for developer inspection & testing
DISPATCHED_EMAILS_LOG: List[Dict[str, Any]] = []


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends an email via configured SMTP server or records simulated delivery in development."""
    sender_name = settings.EMAILS_FROM_NAME or "AquaSense Precision Agriculture"
    sender_email = (
        settings.SMTP_USER
        if (settings.SMTP_USER and "@" in settings.SMTP_USER)
        else settings.EMAILS_FROM_EMAIL
    )
    formatted_from = f"{sender_name} <{sender_email}>"

    log_entry = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "to": to_email,
        "from": formatted_from,
        "subject": subject,
        "text": text_content or "",
        "html_preview": html_content[:200] + "...",
        "delivered": False,
        "method": "simulated_dev",
    }

    # If live SMTP credentials are provided, attempt real SMTP transmission
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = formatted_from
            msg["To"] = to_email

            if text_content:
                msg.attach(MIMEText(text_content, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(sender_email, [to_email], msg.as_string())

            log_entry["delivered"] = True
            log_entry["method"] = "smtp"
            logger.info(f"✅ Real email successfully delivered via SMTP to {to_email}: {subject}")
        except Exception as e:
            logger.warning(
                f"⚠️ SMTP transmission to {to_email} failed ({str(e)}). Fallback to simulated delivery logged."
            )
            log_entry["error"] = str(e)
            log_entry["delivered"] = False
            log_entry["method"] = "smtp_fallback_simulated"
    else:
        logger.info(
            f"📧 [DEV EMAIL DISPATCH] To: {to_email} | Subject: '{subject}' | Dev Fallback Logged (SMTP credentials not configured)."
        )

    DISPATCHED_EMAILS_LOG.append(log_entry)
    # Keep last 100 emails in memory
    if len(DISPATCHED_EMAILS_LOG) > 100:
        DISPATCHED_EMAILS_LOG.pop(0)

    return log_entry


def test_smtp_connection(to_email: str) -> Dict[str, Any]:
    """Tests live SMTP credentials by connecting, authenticating, and sending a test email."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return {
            "success": False,
            "smtp_configured": False,
            "message": "SMTP credentials (SMTP_USER or SMTP_PASSWORD) are not configured in backend/.env.",
            "error": "Missing SMTP_USER or SMTP_PASSWORD",
        }

    sender_name = settings.EMAILS_FROM_NAME or "AquaSense Precision Agriculture"
    sender_email = (
        settings.SMTP_USER
        if (settings.SMTP_USER and "@" in settings.SMTP_USER)
        else settings.EMAILS_FROM_EMAIL
    )
    formatted_from = f"{sender_name} <{sender_email}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🧪 [AquaSense Test] Live SMTP Email Delivery Verified!"
    msg["From"] = formatted_from
    msg["To"] = to_email

    text_content = (
        f"This is an automated test email confirming that live SMTP delivery is properly configured "
        f"and functional for AquaSense Precision Agriculture. Dispatched to {to_email}."
    )
    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #065f46; margin-top: 0; font-size: 20px;">✅ AquaSense Live SMTP Delivery Verified</h2>
      <p style="color: #1e293b; font-size: 14px; line-height: 1.6;">Great news! Your SMTP mail relay (<strong>{settings.SMTP_HOST}:{settings.SMTP_PORT}</strong>) is connected and functioning properly.</p>
      <p style="color: #334155; font-size: 13px; line-height: 1.6;">Platform announcements, monsoonal weather advisories, and password recovery OTP codes can now be delivered directly to users' personal email inboxes.</p>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0;">
      <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">Recipient: <strong>{to_email}</strong> • Dispatched at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
    </div>
    """
    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender_email, [to_email], msg.as_string())

        return {
            "success": True,
            "smtp_configured": True,
            "message": f"Test email successfully transmitted via SMTP to '{to_email}'! Please check your inbox or spam folder.",
            "sender": formatted_from,
            "host": f"{settings.SMTP_HOST}:{settings.SMTP_PORT}",
        }
    except Exception as e:
        return {
            "success": False,
            "smtp_configured": True,
            "message": f"SMTP transmission failed: {str(e)}",
            "error": str(e),
            "host": f"{settings.SMTP_HOST}:{settings.SMTP_PORT}",
        }


def send_password_reset_otp_email(
    to_email: str,
    otp_code: str,
    user_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends a 6-digit OTP verification email for password recovery."""
    greeting = f"Hello {user_name}," if user_name else "Hello Farmer,"
    subject = f"🔐 Your AquaSense Password Reset OTP: {otp_code}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
        .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ background: #059669; padding: 24px; text-align: center; color: #ffffff; }}
        .content {{ padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px; }}
        .otp-box {{ background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #065f46; font-family: monospace; }}
        .warning {{ background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #991b1b; margin-top: 20px; }}
        .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700;">🌱 AquaSense-IoT</h2>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Precision Irrigation & Agricultural Support</p>
        </div>
        <div class="content">
          <p>{greeting}</p>
          <p>We received a request to reset your password. Use the 6-digit One-Time Password (OTP) below to authenticate your account and set a new password:</p>
          
          <div class="otp-box">
            <span style="font-size: 11px; text-transform: uppercase; color: #047857; font-weight: 700; display: block; margin-bottom: 6px;">Your 6-Digit Verification Code</span>
            <span class="otp-code">{otp_code}</span>
          </div>

          <p style="font-size: 13px; color: #64748b; margin: 0;">⏳ <strong>Valid for 15 minutes.</strong> Do not share this OTP with anyone, including farm coordinators.</p>
          
          <div class="warning">
            If you did not request this password reset, you can safely ignore this email. Your current password remains secure.
          </div>
        </div>
        <div class="footer">
          AquaSense Precision Irrigation Framework • Kurnool Regional Center<br>
          Automated Soil-Water-Atmospheric Decision System
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
    AquaSense-IoT Password Reset
    {greeting}
    
    Your 6-digit verification code is: {otp_code}
    
    This code is valid for 15 minutes. Enter this OTP on the password reset screen to configure a new password.
    
    If you did not request this, please ignore this email.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_admin_update_email(
    to_email: str,
    subject: str,
    message: str,
    admin_name: str = "AquaSense Administrator",
    urgency: str = "normal",
    user_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends an administrative platform announcement or farm update to a user's personal email."""
    greeting = f"Dear {user_name}," if user_name else "Dear Farmer / Farm Manager,"
    
    urgency_badge = {
        "normal": ("#10b981", "📢 General Farm & Platform Advisory"),
        "high": ("#f59e0b", "⚠️ Important Weather / Irrigation Alert"),
        "critical": ("#ef4444", "🚨 Critical Monsoonal / Hardware Emergency"),
    }.get(urgency, ("#10b981", "📢 Official Platform Announcement"))

    badge_color, badge_text = urgency_badge

    formatted_message = message.replace("\n", "<br>")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
        .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ background: #0f172a; padding: 24px; color: #ffffff; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #ffffff; background: {badge_color}; margin-bottom: 10px; }}
        .content {{ padding: 28px 24px; color: #334155; line-height: 1.7; font-size: 14px; }}
        .message-box {{ background: #f8fafc; border-left: 4px solid {badge_color}; border-radius: 8px; padding: 18px; margin: 20px 0; color: #1e293b; font-size: 14px; }}
        .btn {{ display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-top: 15px; }}
        .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">{badge_text}</span>
          <h2 style="margin: 0; font-size: 19px; font-weight: 700;">{subject}</h2>
          <p style="margin: 6px 0 0; font-size: 12px; color: #94a3b8;">Dispatched by {admin_name} • AquaSense Operations</p>
        </div>
        <div class="content">
          <p>{greeting}</p>
          <p>The AquaSense administration team has issued an official update regarding your agricultural fields and monitoring services:</p>
          
          <div class="message-box">
            {formatted_message}
          </div>

          <p style="font-size: 13px; color: #475569;">Please log into your dashboard to check live sensor readings, updated FAO-56 irrigation schedules, and weather forecasts:</p>
          <p style="text-align: center;"><a href="http://localhost:3000" class="btn">👉 View Farm Dashboard</a></p>
        </div>
        <div class="footer">
          AquaSense Precision Agriculture Platform • Administrative Broadcast System<br>
          Automated Hydrological Scheduling &amp; Soil-Water Protection
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
    AquaSense Administrative Update: {subject}
    From: {admin_name}
    
    {greeting}
    
    {message}
    
    Log into your dashboard at http://localhost:3000 to review details.
    """

    return send_email(to_email, f"📢 [AquaSense Update] {subject}", html_content, text_content)
