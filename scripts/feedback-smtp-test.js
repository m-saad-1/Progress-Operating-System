/**
 * Feedback System — SMTP Test Script
 *
 * Verifies that SMTP credentials are configured correctly by sending
 * a test email. Run with: pnpm feedback:test
 *
 * Reads configuration from .env file in the project root.
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Load .env manually
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ No .env file found at:', envPath);
    console.error('   Copy .env.example to .env and fill in your SMTP credentials.');
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          PersonalOS — Feedback SMTP Test                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const host = process.env.FEEDBACK_SMTP_HOST;
  const port = parseInt(process.env.FEEDBACK_SMTP_PORT || '587', 10);
  const secure = process.env.FEEDBACK_SMTP_SECURE === 'true';
  const user = process.env.FEEDBACK_SMTP_USER;
  const pass = process.env.FEEDBACK_SMTP_PASS;
  const toEmail = process.env.FEEDBACK_TO_EMAIL || user;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || user;
  const fromName = process.env.FEEDBACK_FROM_NAME || 'PersonalOS Feedback';

  // Validate required config
  const missing = [];
  if (!host) missing.push('FEEDBACK_SMTP_HOST');
  if (!user) missing.push('FEEDBACK_SMTP_USER');
  if (!pass) missing.push('FEEDBACK_SMTP_PASS');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('\n   Set these in your .env file. See .env.example for details.');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Host:   ${host}:${port} (${secure ? 'SSL' : 'STARTTLS'})`);
  console.log(`  User:   ${user}`);
  console.log(`  Pass:   ${'*'.repeat(Math.min(pass.length, 16))}`);
  console.log(`  From:   "${fromName}" <${fromEmail}>`);
  console.log(`  To:     ${toEmail}`);
  console.log('');

  // Step 1: Create transporter
  console.log('1️⃣  Creating SMTP transporter...');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  // Step 2: Verify connection
  console.log('2️⃣  Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('   ✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.error('   ❌ SMTP verification failed:', error.message);
    console.error('\n   Common fixes:');
    console.error('   • Gmail: Enable 2FA → Create App Password at https://myaccount.google.com/apppasswords');
    console.error('   • Outlook: Use app password or enable SMTP AUTH');
    console.error('   • Check host/port/secure settings');
    process.exit(1);
  }

  // Step 3: Send test email
  console.log('3️⃣  Sending test email...');
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: '[PersonalOS] ✅ Feedback Test — SMTP Working',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">✅ Feedback System Working</h1>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; margin: 0 0 12px;">Your PersonalOS feedback system is configured correctly.</p>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              SMTP: ${host}:${port}<br/>
              Sent: ${new Date().toISOString()}<br/>
              Node: ${process.version}
            </p>
          </div>
        </div>
      `,
      text: `PersonalOS Feedback Test\n\nYour feedback system is configured correctly.\nSMTP: ${host}:${port}\nSent: ${new Date().toISOString()}`,
    });

    console.log('   ✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`\n📬 Check your inbox at: ${toEmail}`);
    console.log('\n✅ Feedback system is ready to use!');
  } catch (error) {
    console.error('   ❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
