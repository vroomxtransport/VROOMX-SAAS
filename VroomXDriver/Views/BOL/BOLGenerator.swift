import UIKit

// MARK: - BOL Generator

/// Generates a 2-page Bill of Lading PDF from inspection and order data.
/// Page 1: Vehicle info, inspection details, damage summary, signatures.
/// Page 2: Terms & conditions, financial summary, certifications.
enum BOLGenerator {

    // MARK: - Generate BOL

    /// Generates a 2-page BOL PDF.
    /// - Returns: PDF data or nil if generation fails.
    static func generateBOL(
        order: VroomXOrder,
        pickupInspection: VehicleInspection?,
        deliveryInspection: VehicleInspection?,
        pickupDamages: [InspectionDamage],
        deliveryDamages: [InspectionDamage],
        driverSignatureImage: UIImage?,
        customerSignatureImage: UIImage?,
        driverName: String,
        truckNumber: String?
    ) -> Data? {
        let pageRect = CGRect(x: 0, y: 0, width: PDFGenerator.letterWidth, height: PDFGenerator.letterHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        let data = renderer.pdfData { context in
            // PAGE 1: Inspection Details
            context.beginPage()
            drawPage1(
                order: order,
                pickupInspection: pickupInspection,
                deliveryInspection: deliveryInspection,
                pickupDamages: pickupDamages,
                deliveryDamages: deliveryDamages,
                driverSignatureImage: driverSignatureImage,
                customerSignatureImage: customerSignatureImage,
                driverName: driverName,
                truckNumber: truckNumber
            )

            // PAGE 2: Terms & Signatures
            context.beginPage()
            drawPage2(
                order: order,
                pickupInspection: pickupInspection,
                deliveryInspection: deliveryInspection,
                pickupDamages: pickupDamages,
                deliveryDamages: deliveryDamages,
                driverSignatureImage: driverSignatureImage,
                customerSignatureImage: customerSignatureImage,
                driverName: driverName
            )
        }

        return data
    }

    // MARK: - Page 1: Inspection Details

    private static func drawPage1(
        order: VroomXOrder,
        pickupInspection: VehicleInspection?,
        deliveryInspection: VehicleInspection?,
        pickupDamages: [InspectionDamage],
        deliveryDamages: [InspectionDamage],
        driverSignatureImage: UIImage?,
        customerSignatureImage: UIImage?,
        driverName: String,
        truckNumber: String?
    ) {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var y: CGFloat = PDFGenerator.marginTop

        // -- Header --
        y = drawHeader(at: y, orderNumber: order.orderNumber ?? "N/A")

        // -- Vehicle Info Box --
        y = drawVehicleInfoBox(at: y, order: order, truckNumber: truckNumber)

        // -- Pickup Inspection Section --
        if let pickup = pickupInspection {
            y += 12
            y = drawInspectionSection(
                at: y,
                title: "PICKUP INSPECTION",
                inspection: pickup,
                damages: pickupDamages,
                signatureImage: driverSignatureImage,
                customerSignatureImage: customerSignatureImage
            )
        }

        // -- Delivery Inspection Section --
        if let delivery = deliveryInspection {
            y += 12
            y = drawInspectionSection(
                at: y,
                title: "DELIVERY INSPECTION",
                inspection: delivery,
                damages: deliveryDamages,
                signatureImage: driverSignatureImage,
                customerSignatureImage: nil
            )
        }

        // -- Condition Comparison (if both inspections exist) --
        if pickupInspection != nil && deliveryInspection != nil {
            y += 12
            y = drawConditionComparison(
                at: y,
                pickupDamages: pickupDamages,
                deliveryDamages: deliveryDamages
            )
        }

        // -- Footer --
        drawPageFooter(pageNumber: 1)
    }

    // MARK: - Page 2: Terms & Signatures

    private static func drawPage2(
        order: VroomXOrder,
        pickupInspection: VehicleInspection?,
        deliveryInspection: VehicleInspection?,
        pickupDamages: [InspectionDamage],
        deliveryDamages: [InspectionDamage],
        driverSignatureImage: UIImage?,
        customerSignatureImage: UIImage?,
        driverName: String
    ) {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var y: CGFloat = PDFGenerator.marginTop

        // -- Header --
        PDFGenerator.drawRect(
            CGRect(x: m, y: y, width: cw, height: 24),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "TERMS & CONDITIONS",
            at: CGPoint(x: m + 8, y: y + 5),
            font: PDFGenerator.headerFont,
            color: .white
        )
        y += 30

        // -- Terms Text --
        let terms = [
            "1. The carrier agrees to transport the vehicle(s) described herein from the pickup location to the delivery location in accordance with the terms of the transport agreement.",
            "2. The carrier shall exercise reasonable care in the transportation of the vehicle(s) and shall be liable for any damage caused by the carrier's negligence during transport.",
            "3. The shipper/customer acknowledges that the condition of the vehicle at pickup has been documented in the inspection report on page 1 of this Bill of Lading.",
            "4. Any pre-existing damage noted at the time of pickup is the responsibility of the shipper and is not the carrier's liability.",
            "5. Claims for damage must be noted on this Bill of Lading at the time of delivery. Any damage not noted at delivery will not be the carrier's responsibility.",
            "6. The carrier's liability is limited to the terms of the carrier's insurance policy. The carrier does not provide full-value cargo insurance unless separately arranged.",
            "7. The shipper certifies that the vehicle is in operable condition and free of personal property not documented herein.",
            "8. This Bill of Lading, when signed by both parties, constitutes a legally binding contract for the transportation of the vehicle(s) described."
        ]

        for term in terms {
            let rect = PDFGenerator.drawText(
                term,
                at: CGPoint(x: m + 4, y: y),
                font: PDFGenerator.smallFont,
                color: PDFGenerator.darkGray,
                maxWidth: cw - 8
            )
            y += rect.height + 4
        }

        y += 12

        // -- Financial Summary --
        PDFGenerator.drawRect(
            CGRect(x: m, y: y, width: cw, height: 24),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "FINANCIAL SUMMARY",
            at: CGPoint(x: m + 8, y: y + 5),
            font: PDFGenerator.headerFont,
            color: .white
        )
        y += 28

        let currencyFormatter = NumberFormatter()
        currencyFormatter.numberStyle = .currency
        currencyFormatter.currencyCode = "USD"

        let financialRows: [(String, String)] = [
            ("Revenue:", currencyFormatter.string(from: NSNumber(value: order.revenue ?? 0)) ?? "$0.00"),
            ("Carrier Pay:", currencyFormatter.string(from: NSNumber(value: order.carrierPay ?? 0)) ?? "$0.00"),
            ("Payment Type:", order.paymentType?.displayName ?? "N/A"),
            ("Payment Status:", order.paymentStatus ?? "N/A")
        ]

        for (label, value) in financialRows {
            PDFGenerator.drawText(
                label,
                at: CGPoint(x: m + 8, y: y),
                font: PDFGenerator.bodyBoldFont,
                color: PDFGenerator.darkGray
            )
            PDFGenerator.drawTextRight(
                value,
                at: CGPoint(x: m, y: y),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray,
                maxWidth: cw
            )
            y += 14
        }

        PDFGenerator.drawLine(
            from: CGPoint(x: m, y: y + 2),
            to: CGPoint(x: m + cw, y: y + 2),
            color: PDFGenerator.lightGray
        )
        y += 16

        // -- Driver Certification --
        PDFGenerator.drawRect(
            CGRect(x: m, y: y, width: cw, height: 24),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "DRIVER CERTIFICATION",
            at: CGPoint(x: m + 8, y: y + 5),
            font: PDFGenerator.headerFont,
            color: .white
        )
        y += 28

        let driverCert = "I, \(driverName), certify that I have inspected the vehicle(s) described in this Bill of Lading and that the condition report accurately reflects the vehicle's condition at the time of inspection."
        let certRect = PDFGenerator.drawText(
            driverCert,
            at: CGPoint(x: m + 4, y: y),
            font: PDFGenerator.bodyFont,
            color: PDFGenerator.darkGray,
            maxWidth: cw - 8
        )
        y += certRect.height + 8

        // Driver signature
        PDFGenerator.drawSignature(
            nil,
            signatureImage: driverSignatureImage,
            in: CGRect(x: m + 4, y: y, width: (cw - 16) / 2, height: 50),
            label: "Driver Signature"
        )

        // Date
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        PDFGenerator.drawText(
            "Date: \(dateFormatter.string(from: Date()))",
            at: CGPoint(x: m + cw / 2 + 8, y: y + 10),
            font: PDFGenerator.bodyFont,
            color: PDFGenerator.darkGray
        )
        PDFGenerator.drawText(
            "Driver: \(driverName)",
            at: CGPoint(x: m + cw / 2 + 8, y: y + 24),
            font: PDFGenerator.bodyBoldFont,
            color: PDFGenerator.darkGray
        )

        y += 60

        // -- Customer Certification --
        PDFGenerator.drawRect(
            CGRect(x: m, y: y, width: cw, height: 24),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "CUSTOMER CERTIFICATION",
            at: CGPoint(x: m + 8, y: y + 5),
            font: PDFGenerator.headerFont,
            color: .white
        )
        y += 28

        let customerName = pickupInspection?.customerName ?? deliveryInspection?.customerName ?? "Customer"
        let customerCert = "I, \(customerName), acknowledge that I have reviewed the vehicle condition as described in this Bill of Lading and agree to the terms set forth herein."
        let custCertRect = PDFGenerator.drawText(
            customerCert,
            at: CGPoint(x: m + 4, y: y),
            font: PDFGenerator.bodyFont,
            color: PDFGenerator.darkGray,
            maxWidth: cw - 8
        )
        y += custCertRect.height + 8

        // Customer signature
        PDFGenerator.drawSignature(
            nil,
            signatureImage: customerSignatureImage,
            in: CGRect(x: m + 4, y: y, width: (cw - 16) / 2, height: 50),
            label: "Customer Signature"
        )

        // Customer name and date
        PDFGenerator.drawText(
            "Date: \(dateFormatter.string(from: Date()))",
            at: CGPoint(x: m + cw / 2 + 8, y: y + 10),
            font: PDFGenerator.bodyFont,
            color: PDFGenerator.darkGray
        )
        PDFGenerator.drawText(
            "Customer: \(customerName)",
            at: CGPoint(x: m + cw / 2 + 8, y: y + 24),
            font: PDFGenerator.bodyBoldFont,
            color: PDFGenerator.darkGray
        )

        // -- Footer --
        drawPageFooter(pageNumber: 2)
    }

    // MARK: - Header

    private static func drawHeader(at y: CGFloat, orderNumber: String) -> CGFloat {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var currentY = y

        // Blue header bar
        PDFGenerator.drawRect(
            CGRect(x: m, y: currentY, width: cw, height: 36),
            fill: PDFGenerator.brandBlue,
            cornerRadius: 4
        )

        // Company name
        PDFGenerator.drawText(
            "VroomX Transport",
            at: CGPoint(x: m + 10, y: currentY + 4),
            font: PDFGenerator.titleFont,
            color: .white
        )

        // BOL title right-aligned
        PDFGenerator.drawTextRight(
            "BILL OF LADING",
            at: CGPoint(x: m, y: currentY + 4),
            font: PDFGenerator.titleFont,
            color: .white,
            maxWidth: cw - 10
        )

        currentY += 38

        // Order number and date subline
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .short
        let dateStr = dateFormatter.string(from: Date())

        PDFGenerator.drawText(
            "Order #\(orderNumber)",
            at: CGPoint(x: m + 4, y: currentY + 2),
            font: PDFGenerator.headerFont,
            color: PDFGenerator.darkGray
        )

        PDFGenerator.drawTextRight(
            "Generated: \(dateStr)",
            at: CGPoint(x: m, y: currentY + 2),
            font: PDFGenerator.smallFont,
            color: PDFGenerator.mediumGray,
            maxWidth: cw
        )

        return currentY + 16
    }

    // MARK: - Vehicle Info Box

    private static func drawVehicleInfoBox(at y: CGFloat, order: VroomXOrder, truckNumber: String?) -> CGFloat {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var currentY = y

        // Section header
        PDFGenerator.drawRect(
            CGRect(x: m, y: currentY, width: cw, height: 20),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "VEHICLE INFORMATION",
            at: CGPoint(x: m + 8, y: currentY + 4),
            font: PDFGenerator.headerFont,
            color: .white
        )
        currentY += 22

        // Info box background
        let boxHeight: CGFloat = 56
        PDFGenerator.drawRect(
            CGRect(x: m, y: currentY, width: cw, height: boxHeight),
            fill: PDFGenerator.veryLightGray,
            stroke: PDFGenerator.lightGray
        )

        let colWidth = cw / 3

        // Row 1
        drawInfoCell(label: "Year", value: order.vehicleYear.map { String($0) } ?? "N/A", at: CGPoint(x: m + 8, y: currentY + 4))
        drawInfoCell(label: "Make", value: order.vehicleMake ?? "N/A", at: CGPoint(x: m + colWidth + 8, y: currentY + 4))
        drawInfoCell(label: "Model", value: order.vehicleModel ?? "N/A", at: CGPoint(x: m + colWidth * 2 + 8, y: currentY + 4))

        // Row 2
        drawInfoCell(label: "VIN", value: order.vehicleVin ?? "N/A", at: CGPoint(x: m + 8, y: currentY + 28))
        drawInfoCell(label: "Color", value: order.vehicleColor ?? "N/A", at: CGPoint(x: m + colWidth + 8, y: currentY + 28))
        drawInfoCell(label: "Type", value: order.vehicleType ?? "N/A", at: CGPoint(x: m + colWidth * 2 + 8, y: currentY + 28))

        currentY += boxHeight + 2

        // Truck number if available
        if let truck = truckNumber, !truck.isEmpty {
            PDFGenerator.drawText(
                "Truck: \(truck)",
                at: CGPoint(x: m + 8, y: currentY),
                font: PDFGenerator.smallFont,
                color: PDFGenerator.mediumGray
            )
            currentY += 10
        }

        return currentY
    }

    private static func drawInfoCell(label: String, value: String, at point: CGPoint) {
        PDFGenerator.drawText(label, at: point, font: PDFGenerator.smallFont, color: PDFGenerator.mediumGray)
        PDFGenerator.drawText(
            value,
            at: CGPoint(x: point.x, y: point.y + 8),
            font: PDFGenerator.bodyBoldFont,
            color: PDFGenerator.darkGray
        )
    }

    // MARK: - Inspection Section

    private static func drawInspectionSection(
        at y: CGFloat,
        title: String,
        inspection: VehicleInspection,
        damages: [InspectionDamage],
        signatureImage: UIImage?,
        customerSignatureImage: UIImage?
    ) -> CGFloat {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var currentY = y

        // Section header
        PDFGenerator.drawRect(
            CGRect(x: m, y: currentY, width: cw, height: 20),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            title,
            at: CGPoint(x: m + 8, y: currentY + 4),
            font: PDFGenerator.headerFont,
            color: .white
        )
        currentY += 24

        // Address and date
        if let address = inspection.gpsAddress {
            PDFGenerator.drawText(
                "Location: \(address)",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray
            )
            currentY += 12
        }

        if let completedAt = inspection.completedAt {
            PDFGenerator.drawText(
                "Date: \(formatDate(completedAt))",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray
            )
            currentY += 12
        }

        if let odometer = inspection.odometerReading {
            PDFGenerator.drawText(
                "Odometer: \(odometer) mi",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray
            )
            currentY += 12
        }

        if let interior = inspection.interiorCondition {
            PDFGenerator.drawText(
                "Interior Condition: \(interior.capitalized)",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray
            )
            currentY += 12
        }

        // Notes
        if let notes = inspection.notes, !notes.isEmpty {
            PDFGenerator.drawText(
                "Notes: \(notes)",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.darkGray,
                maxWidth: cw - 8
            )
            currentY += 14
        }

        currentY += 4

        // Damage summary
        if damages.isEmpty {
            PDFGenerator.drawText(
                "No damage reported",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyFont,
                color: PDFGenerator.mediumGray
            )
            currentY += 14
        } else {
            PDFGenerator.drawText(
                "Damage Report (\(damages.count) item\(damages.count == 1 ? "" : "s")):",
                at: CGPoint(x: m + 4, y: currentY),
                font: PDFGenerator.bodyBoldFont,
                color: PDFGenerator.darkGray
            )
            currentY += 12

            // Damage table header
            let cols: [(String, CGFloat)] = [
                ("Type", 80),
                ("View", 80),
                ("Position", 120),
                ("Description", cw - 280)
            ]

            PDFGenerator.drawTableRow(columns: cols, at: currentY, isHeader: true)
            currentY += 16

            for (i, damage) in damages.enumerated() {
                let row: [(String, CGFloat)] = [
                    (damage.damageType.displayName, 80),
                    (damage.view.capitalized, 80),
                    (String(format: "(%.0f%%, %.0f%%)", damage.xPosition * 100, damage.yPosition * 100), 120),
                    (damage.description ?? "—", cw - 280)
                ]
                PDFGenerator.drawTableRow(columns: row, at: currentY, isAlternate: i % 2 == 1)
                currentY += 16
            }
        }

        currentY += 8

        // Signatures row
        let sigWidth = (cw - 16) / 2

        PDFGenerator.drawSignature(
            inspection.driverSignatureUrl,
            signatureImage: signatureImage,
            in: CGRect(x: m + 4, y: currentY, width: sigWidth, height: 40),
            label: "Driver Signature"
        )

        if let custSig = customerSignatureImage {
            PDFGenerator.drawSignature(
                inspection.customerSignatureUrl,
                signatureImage: custSig,
                in: CGRect(x: m + sigWidth + 12, y: currentY, width: sigWidth, height: 40),
                label: "Customer: \(inspection.customerName ?? "N/A")"
            )
        }

        currentY += 52

        return currentY
    }

    // MARK: - Condition Comparison

    private static func drawConditionComparison(
        at y: CGFloat,
        pickupDamages: [InspectionDamage],
        deliveryDamages: [InspectionDamage]
    ) -> CGFloat {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        var currentY = y

        PDFGenerator.drawRect(
            CGRect(x: m, y: currentY, width: cw, height: 20),
            fill: PDFGenerator.brandBlue
        )
        PDFGenerator.drawText(
            "CONDITION COMPARISON",
            at: CGPoint(x: m + 8, y: currentY + 4),
            font: PDFGenerator.headerFont,
            color: .white
        )
        currentY += 24

        let halfWidth = cw / 2

        // Pickup column
        PDFGenerator.drawText(
            "Pickup: \(pickupDamages.count) damage\(pickupDamages.count == 1 ? "" : "s")",
            at: CGPoint(x: m + 8, y: currentY),
            font: PDFGenerator.bodyBoldFont,
            color: PDFGenerator.darkGray
        )

        // Delivery column
        PDFGenerator.drawText(
            "Delivery: \(deliveryDamages.count) damage\(deliveryDamages.count == 1 ? "" : "s")",
            at: CGPoint(x: m + halfWidth + 8, y: currentY),
            font: PDFGenerator.bodyBoldFont,
            color: PDFGenerator.darkGray
        )
        currentY += 14

        // Damage type breakdown
        for type in DamageType.allCases {
            let pickupCount = pickupDamages.filter { $0.damageType == type }.count
            let deliveryCount = deliveryDamages.filter { $0.damageType == type }.count

            if pickupCount > 0 || deliveryCount > 0 {
                PDFGenerator.drawText(
                    "  \(type.displayName): \(pickupCount)",
                    at: CGPoint(x: m + 8, y: currentY),
                    font: PDFGenerator.bodyFont,
                    color: PDFGenerator.mediumGray
                )
                PDFGenerator.drawText(
                    "  \(type.displayName): \(deliveryCount)",
                    at: CGPoint(x: m + halfWidth + 8, y: currentY),
                    font: PDFGenerator.bodyFont,
                    color: PDFGenerator.mediumGray
                )
                currentY += 12
            }
        }

        // New damage count
        let newDamages = deliveryDamages.count - pickupDamages.count
        if newDamages > 0 {
            currentY += 4
            PDFGenerator.drawText(
                "New damages found at delivery: \(newDamages)",
                at: CGPoint(x: m + 8, y: currentY),
                font: PDFGenerator.bodyBoldFont,
                color: UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 1)
            )
            currentY += 14
        }

        return currentY
    }

    // MARK: - Page Footer

    private static func drawPageFooter(pageNumber: Int) {
        let m = PDFGenerator.marginLeft
        let cw = PDFGenerator.contentWidth
        let footerY = PDFGenerator.letterHeight - PDFGenerator.marginBottom

        PDFGenerator.drawLine(
            from: CGPoint(x: m, y: footerY - 4),
            to: CGPoint(x: m + cw, y: footerY - 4),
            color: PDFGenerator.lightGray
        )

        PDFGenerator.drawText(
            "Generated by VroomX Driver App",
            at: CGPoint(x: m, y: footerY),
            font: PDFGenerator.smallFont,
            color: PDFGenerator.mediumGray
        )

        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .short

        PDFGenerator.drawTextRight(
            "Page \(pageNumber) of 2  •  \(dateFormatter.string(from: Date()))",
            at: CGPoint(x: m, y: footerY),
            font: PDFGenerator.smallFont,
            color: PDFGenerator.mediumGray,
            maxWidth: cw
        )
    }

    // MARK: - Helpers

    private static func formatDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first, then without
        if let date = isoFormatter.date(from: isoString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }

        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: isoString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }

        return isoString
    }
}
