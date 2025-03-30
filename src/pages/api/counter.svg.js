export async function GET() {
  const response = await fetch('https://librecounter.org/counter.svg')
  const svg = await response.text()

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache'
    }
  })
}
