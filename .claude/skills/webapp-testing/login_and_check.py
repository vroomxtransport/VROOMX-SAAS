from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Capture console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

    # Go to login page
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')

    # Fill in login form
    page.fill('input[type="email"]', 'info@vroomxtransport.com')
    page.fill('input[type="password"]', 'VroomX2025!')
    page.click('button[type="submit"]')

    # Wait for navigation to dashboard
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(5000)

    print(f"Current URL: {page.url}")

    # Take screenshot
    page.screenshot(path='/tmp/dashboard_logged_in.png', full_page=True)

    # Check for react-grid-layout
    grid_info = page.evaluate("""() => {
        const rgl = document.querySelector('.react-grid-layout');
        if (rgl) {
            return {
                exists: true,
                childCount: rgl.children.length,
                height: rgl.style.height,
            };
        }
        // Check if there are any visible errors
        const errorEl = document.querySelector('[class*="error"]');
        return {
            exists: false,
            errorText: errorEl?.textContent?.substring(0, 200) || null,
            bodyClass: document.body.className,
        };
    }""")
    print(f"Grid info: {grid_info}")

    # Print any error console messages
    errors = [m for m in console_messages if m.startswith('[error')]
    if errors:
        print(f"Console errors ({len(errors)}):")
        for e in errors[:10]:
            print(f"  {e[:200]}")
    else:
        print("No console errors")

    browser.close()
