from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    # Launch VISIBLE browser so user can sign in
    browser = p.chromium.launch(headless=False)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Capture all console messages
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    # Go to login
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')

    print("=" * 60)
    print("BROWSER IS OPEN — Please sign in manually.")
    print("Waiting 30 seconds for you to log in...")
    print("=" * 60)

    # Wait for user to sign in and get redirected to dashboard
    for i in range(30):
        time.sleep(1)
        url = page.url
        if '/dashboard' in url:
            print(f"  -> Detected dashboard URL: {url}")
            break
        if i % 5 == 0:
            print(f"  Waiting... ({i}s) - Current URL: {url}")

    # Extra wait for dashboard to fully render
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    print(f"\nFinal URL: {page.url}")

    # Screenshot 1: Full page
    page.screenshot(path='/tmp/dash_test_1_full.png', full_page=True)
    print("Saved: /tmp/dash_test_1_full.png")

    # Screenshot 2: Viewport only
    page.screenshot(path='/tmp/dash_test_2_viewport.png', full_page=False)
    print("Saved: /tmp/dash_test_2_viewport.png")

    # Check grid layout
    grid_info = page.evaluate("""() => {
        const rgl = document.querySelector('.react-grid-layout');
        if (rgl) {
            const rect = rgl.getBoundingClientRect();
            return {
                exists: true,
                width: rect.width,
                height: rect.height,
                childCount: rgl.children.length,
                children: Array.from(rgl.children).map(c => {
                    const r = c.getBoundingClientRect();
                    return {
                        class: c.className.substring(0, 60),
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                        top: Math.round(r.top),
                        left: Math.round(r.left),
                        style: c.getAttribute('style')?.substring(0, 150) || ''
                    };
                })
            };
        }
        return { exists: false, bodyHTML: document.body.innerHTML.substring(0, 500) };
    }""")
    print(f"\n{'=' * 60}")
    print(f"GRID LAYOUT INFO:")
    print(f"{'=' * 60}")
    if grid_info.get('exists'):
        print(f"  Grid: {grid_info['width']}x{grid_info['height']}px, {grid_info['childCount']} children")
        for i, child in enumerate(grid_info.get('children', [])):
            print(f"  [{i}] {child['width']}x{child['height']}px at ({child['left']}, {child['top']})")
            print(f"       style: {child['style']}")
    else:
        print(f"  NO .react-grid-layout element found!")
        print(f"  Body preview: {grid_info.get('bodyHTML', 'N/A')[:300]}")

    # Print console errors
    errors = [m for m in console_msgs if '[error]' in m.lower() or '[warn]' in m.lower()]
    if errors:
        print(f"\nConsole errors/warnings ({len(errors)}):")
        for e in errors[:15]:
            print(f"  {e[:200]}")

    print("\nKeeping browser open for 15 more seconds for manual inspection...")
    time.sleep(15)

    browser.close()
    print("Done!")
