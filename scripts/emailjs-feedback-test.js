#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const loadDotEnv = () => {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) continue

    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadDotEnv()

const required = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
]

const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  console.error('Missing required environment variables:')
  missing.forEach((key) => console.error(`- ${key}`))
  process.exit(1)
}

const payload = {
  service_id: process.env.EMAILJS_SERVICE_ID,
  template_id: process.env.EMAILJS_TEMPLATE_ID,
  user_id: process.env.EMAILJS_PUBLIC_KEY,
  accessToken: process.env.EMAILJS_PRIVATE_KEY,
  template_params: {
    feedback_type: 'general-feedback',
    message: 'EmailJS test message from PersonalOS script',
    admin_email: process.env.EMAILJS_TEST_EMAIL || 'mhsaad23305@gmail.com',
    user_email: process.env.EMAILJS_TEST_EMAIL || 'test@example.com',
    screenshot_name: 'Not provided',
    screenshot_data_url: '',
    app_version: process.env.npm_package_version || 'unknown',
    operating_system: process.platform,
    submitted_at: new Date().toISOString(),
    current_page: '/settings (help-support)',
  },
}

async function run() {
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`EmailJS request failed (${response.status}): ${text}`)
    }

    console.log('EmailJS test email sent successfully.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/non-browser applications/i.test(message)) {
      console.error('EmailJS rejected this Node.js test call: API calls are disabled for non-browser applications.')
      console.error('Use feedback submit from the desktop app UI (renderer/browser context), or enable non-browser API access in EmailJS dashboard settings.')
      process.exit(1)
    }
    console.error('Failed to send EmailJS test email:', message)
    process.exit(1)
  }
}

run()
