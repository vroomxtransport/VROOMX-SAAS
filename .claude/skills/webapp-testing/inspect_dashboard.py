from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto('http://localhost:3000/dashboard')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)  # Extra wait for client-side hydration
    page.screenshot(path='/tmp/dashboard_full.png', full_page=True)

    # Also take a viewport-only screenshot
    page.screenshot(path='/tmp/dashboard_viewport.png', full_page=False)

    # Check for any console errors
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Inspect the grid layout structure
    grid_html = page.evaluate("""() => {
        const rgl = document.querySelector('.react-grid-layout');
        if (rgl) {
            return {
                exists: true,
                className: rgl.className,
                childCount: rgl.children.length,
                style: rgl.getAttribute('style'),
                children: Array.from(rgl.children).slice(0, 5).map(c => ({
                    className: c.className.substring(0, 100),
                    style: c.getAttribute('style')?.substring(0, 200)
                }))
            };
        }
        return { exists: false };
    }""")
    print("Grid layout info:", grid_html)

    # Check if widgets are rendered
    widget_count = page.locator('.react-grid-item').count()
    print(f"react-grid-items found: {widget_count}")

    # Take screenshot after reload
    page.screenshot(path='/tmp/dashboard_after_reload.png', full_page=True)

    browser.close()
    print("Screenshots saved to /tmp/dashboard_full.png, /tmp/dashboard_viewport.png, /tmp/dashboard_after_reload.png")
