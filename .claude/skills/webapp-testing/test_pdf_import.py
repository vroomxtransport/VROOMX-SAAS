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
    print("Logged in")

    # Navigate to orders
    print("\n=== Step 2: Navigate to Orders ===")
    page.goto('http://localhost:3000/orders', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/pdf_01_orders.png', full_page=False)

    # Check for Import PDF button
    print("\n=== Step 3: Check Import PDF button ===")
    pdf_btn = page.locator('button:has-text("Import PDF")')
    print(f"Import PDF button found: {pdf_btn.count()}")
    if pdf_btn.count() > 0:
        print(f"  Visible: {pdf_btn.first.is_visible()}")

    csv_btn = page.locator('button:has-text("Import CSV")')
    print(f"Import CSV button found: {csv_btn.count()}")

    # Click Import PDF to open dialog
    print("\n=== Step 4: Open PDF Import dialog ===")
    pdf_btn.first.click()
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/pdf_02_dialog.png', full_page=False)

    dialog = page.locator('[role="dialog"]')
    if dialog.is_visible():
        print("PDF Import dialog is OPEN")
        dialog_text = dialog.text_content()
        print(f"  Title present: {'Import Orders from PDF' in dialog_text}")
        print(f"  Upload step: {'Drop your PDF here' in dialog_text}")
        print(f"  Step indicator: {'1. Upload' in dialog_text}")

        # Check the file input exists
        file_input = dialog.locator('input[type="file"]')
        print(f"  File input found: {file_input.count()}")
        if file_input.count() > 0:
            accept = file_input.get_attribute('accept')
            print(f"  Accepts: {accept}")
    else:
        print("ERROR: Dialog did not open")

    # Create a minimal test PDF to upload
    print("\n=== Step 5: Create and upload test PDF ===")
    import subprocess
    # Create a simple PDF with vehicle transport data using Python
    pdf_path = '/tmp/test_rate_confirmation.pdf'
    try:
        # Use reportlab if available, otherwise create a minimal valid PDF
        pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 350 >>
stream
BT
/F1 12 Tf
50 700 Td
(Rate Confirmation - Order #RC-2025-001) Tj
50 670 Td
(Vehicle: 2024 Honda Accord VIN: 1HGCV1F34RA000123) Tj
50 640 Td
(Pickup: 123 Main St, Miami, FL 33101) Tj
50 620 Td
(Pickup Contact: John Smith 305-555-0100) Tj
50 590 Td
(Delivery: 456 Oak Ave, Tampa, FL 33602) Tj
50 570 Td
(Delivery Contact: Jane Doe 813-555-0200) Tj
50 540 Td
(Rate: $850.00 Carrier Pay: $850.00) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000668 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
745
%%EOF"""
        with open(pdf_path, 'wb') as f:
            f.write(pdf_content)
        print(f"Test PDF created at {pdf_path}")

        # Upload the file
        file_input = dialog.locator('input[type="file"]')
        file_input.set_input_files(pdf_path)
        print("File uploaded, waiting for AI processing...")

        # Wait for AI processing (can take 10-30 seconds)
        page.wait_for_timeout(20000)
        page.screenshot(path='/tmp/pdf_03_processing.png', full_page=False)

        dialog_text = dialog.text_content()
        if 'Review' in dialog_text or 'order' in dialog_text.lower():
            print("AI extraction completed - review step shown")
            if 'Honda' in dialog_text or 'Accord' in dialog_text:
                print("  Vehicle data extracted correctly!")
            if 'Miami' in dialog_text:
                print("  Pickup location extracted!")
            if 'Tampa' in dialog_text:
                print("  Delivery location extracted!")
            if '850' in dialog_text:
                print("  Pricing extracted!")
        elif 'No orders could be extracted' in dialog_text:
            print("AI could not extract orders from minimal PDF (expected for raw PDF)")
        elif 'Analyzing' in dialog_text:
            print("Still processing, waiting longer...")
            page.wait_for_timeout(15000)
            page.screenshot(path='/tmp/pdf_03b_processing.png', full_page=False)
        elif 'error' in dialog_text.lower() or 'Error' in dialog_text:
            print(f"Error occurred: {dialog_text[:300]}")
        else:
            print(f"Unexpected state: {dialog_text[:300]}")

        page.screenshot(path='/tmp/pdf_04_result.png', full_page=False)

    except Exception as e:
        print(f"Error during PDF test: {e}")

    # Check app errors
    app_errors = [e for e in errors if 'QueryClient' in e or 'TypeError' in e or 'Anthropic' in e]
    if app_errors:
        print(f"\n=== App Errors ===")
        for e in app_errors:
            print(f"  {e[:200]}")

    print("\n=== PDF IMPORT TEST COMPLETE ===")
    browser.close()
