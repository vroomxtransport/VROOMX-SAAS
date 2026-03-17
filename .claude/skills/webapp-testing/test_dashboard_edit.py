from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')

    print("=" * 60)
    print("BROWSER IS OPEN — Please sign in manually.")
    print("Waiting 30 seconds for login...")
    print("=" * 60)

    for i in range(30):
        time.sleep(1)
        if '/dashboard' in page.url:
            print(f"  -> Dashboard detected: {page.url}")
            break
        if i % 5 == 0:
            print(f"  Waiting... ({i}s)")

    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # Screenshot 1: Dashboard loaded, scroll down to see all widgets
    page.screenshot(path='/tmp/dash_edit_1_top.png', full_page=False)
    print("Saved top viewport: /tmp/dash_edit_1_top.png")

    # Scroll down to see more widgets
    page.evaluate("window.scrollBy(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/dash_edit_2_scrolled.png', full_page=False)
    print("Saved scrolled view: /tmp/dash_edit_2_scrolled.png")

    # Scroll back to top
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)

    # Click "Customize" button to open popover
    customize_btn = page.locator('button:has-text("Customize")')
    if customize_btn.count() > 0:
        customize_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path='/tmp/dash_edit_3_customize.png', full_page=False)
        print("Saved customize popover: /tmp/dash_edit_3_customize.png")

        # Find and click the "Edit Layout" switch
        edit_switch = page.locator('button[role="switch"]').first
        if edit_switch.count() > 0:
            edit_switch.click()
            page.wait_for_timeout(500)
            # Close popover by clicking elsewhere
            page.mouse.click(100, 100)
            page.wait_for_timeout(500)

            page.screenshot(path='/tmp/dash_edit_4_editmode.png', full_page=False)
            print("Saved edit mode: /tmp/dash_edit_4_editmode.png")

            # Scroll down to see resize handles
            page.evaluate("window.scrollBy(0, 300)")
            page.wait_for_timeout(500)
            page.screenshot(path='/tmp/dash_edit_5_editmode_scrolled.png', full_page=False)
            print("Saved edit mode scrolled: /tmp/dash_edit_5_editmode_scrolled.png")

            # Check for resize handles
            handles = page.locator('.react-resizable-handle').count()
            print(f"\nResize handles found: {handles}")

            # Check grid items
            items = page.locator('.react-grid-item').count()
            print(f"Grid items found: {items}")
        else:
            print("Could not find edit switch")
    else:
        print("Could not find Customize button")

    # Print console errors
    errors = [m for m in console_msgs if '[error]' in m.lower()]
    if errors:
        print(f"\nConsole errors ({len(errors)}):")
        for e in errors[:10]:
            print(f"  {e[:200]}")

    print("\nKeeping browser open for 20 seconds for inspection...")
    time.sleep(20)
    browser.close()
    print("Done!")
