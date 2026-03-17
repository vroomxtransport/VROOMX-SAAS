import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    # Login
    print("=== Step 1: Login ===")
    page.goto('http://localhost:3000/login', wait_until='networkidle', timeout=15000)
    page.fill('input[name="email"]', 'test@vroomx.dev')
    page.fill('input[name="password"]', os.environ.get('TEST_USER_PASSWORD', ''))
    page.click('button:has-text("Sign in")')
    page.wait_for_url('**/dashboard**', timeout=15000)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    print(f"Logged in at: {page.url}")
    page.screenshot(path='/tmp/search_01_dashboard.png', full_page=False)

    # Check search bar visibility
    print("\n=== Step 2: Check search bar ===")
    # The search button has class "hidden sm:flex" — sm breakpoint is 640px, viewport is 1280
    search_btn = page.locator('button:has-text("Search")')
    print(f"Search buttons found: {search_btn.count()}")
    if search_btn.count() > 0:
        print(f"  First visible: {search_btn.first.is_visible()}")
        print(f"  Text: {search_btn.first.text_content().strip()}")

    # Also look for the kbd shortcut
    kbd = page.locator('kbd:has-text("K")')
    print(f"Cmd+K kbd found: {kbd.count()}, visible: {kbd.first.is_visible() if kbd.count() > 0 else 'N/A'}")

    # Open search with keyboard
    print("\n=== Step 3: Open search dialog ===")
    page.keyboard.press('Control+k')  # Use Ctrl+K for headless chromium on macOS
    page.wait_for_timeout(500)

    dialog = page.locator('[role="dialog"]')
    if not dialog.is_visible():
        print("Ctrl+K didn't work, trying click on search button")
        if search_btn.count() > 0 and search_btn.first.is_visible():
            search_btn.first.click()
            page.wait_for_timeout(500)

    if dialog.is_visible():
        print("Search dialog is OPEN")
        page.screenshot(path='/tmp/search_02_dialog_open.png', full_page=False)
    else:
        print("Dialog still not open, trying Meta+K")
        page.keyboard.press('Meta+k')
        page.wait_for_timeout(500)
        if dialog.is_visible():
            print("Meta+K worked!")
        else:
            # Last resort: dispatch keyboard event via JS
            page.evaluate("""
                document.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'k',
                    metaKey: true,
                    bubbles: true,
                    cancelable: true,
                }))
            """)
            page.wait_for_timeout(500)
            if dialog.is_visible():
                print("JS dispatch worked!")

    page.screenshot(path='/tmp/search_02_dialog_open.png', full_page=False)

    if not dialog.is_visible():
        print("ERROR: Could not open search dialog")
        browser.close()
        exit(1)

    # Check category buttons
    print("\n=== Step 4: Category buttons ===")
    cat_buttons = dialog.locator('button').all()
    for btn in cat_buttons:
        text = btn.text_content().strip()
        if text in ['All', 'Orders', 'Drivers', 'Trucks', 'Trips']:
            print(f"  Category: '{text}'")

    # Type search query
    print("\n=== Step 5: Search for 'test' ===")
    search_input = dialog.locator('input')
    search_input.fill('test')
    page.wait_for_timeout(2000)  # debounce + network
    page.screenshot(path='/tmp/search_03_results.png', full_page=False)

    dialog_text = dialog.text_content()
    if 'No results' in dialog_text:
        print("Result: 'No results found' (expected if no matching data)")
    elif 'Searching' in dialog_text:
        print("Still searching, waiting more...")
        page.wait_for_timeout(3000)
        page.screenshot(path='/tmp/search_03b_results.png', full_page=False)
        dialog_text = dialog.text_content()

    # Count results
    result_items = dialog.locator('button').all()
    result_count = 0
    for item in result_items:
        text = item.text_content().strip()
        if text and text not in ['All', 'Orders', 'Drivers', 'Trucks', 'Trips', '']:
            # Check if it looks like a result (has a subtitle)
            if len(text) > 3:
                result_count += 1
                if result_count <= 5:
                    print(f"  Result: '{text[:100]}'")
    print(f"Total clickable results: {result_count}")

    # Test category filter
    print("\n=== Step 6: Click 'Drivers' category ===")
    drivers_cat = dialog.locator('button:has-text("Drivers")').first
    if drivers_cat.is_visible():
        drivers_cat.click()
        page.wait_for_timeout(1500)
        page.screenshot(path='/tmp/search_04_drivers.png', full_page=False)
        print("Drivers filter applied")

    # Close dialog
    print("\n=== Step 7: Close with Escape ===")
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    print(f"Dialog visible after Escape: {dialog.is_visible()}")

    # Filter app errors (ignore PostHog/external)
    app_errors = [e for e in errors if 'QueryClient' in e or 'TypeError' in e or 'ReferenceError' in e]
    if app_errors:
        print(f"\n=== App Errors ({len(app_errors)}) ===")
        for e in app_errors:
            print(f"  {e[:200]}")
    else:
        print("\nNo application errors detected")

    print("\n=== SEARCH BAR TEST COMPLETE ===")
    browser.close()
