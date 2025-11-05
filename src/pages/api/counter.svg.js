const COUNTER_URL = 'https://librecounter.org/counter.svg'

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" role="img" aria-label="Libre counter offline">
  <rect width="120" height="32" fill="#1f2933"/>
  <text x="10" y="21" fill="#f9fafb" font-family="system-ui, sans-serif" font-size="12">
    counter offline
  </text>
</svg>`

export async function GET() {
  try {
    const response = await fetch(COUNTER_URL, {
      headers: {
        'User-Agent': 'liderazgoafectivo.com (astro build)'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to load counter: ${response.status}`)
    }

    const svg = await response.text()

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    })
  } catch {
    return new Response(FALLBACK_SVG, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300'
      }
    })
  }
}
