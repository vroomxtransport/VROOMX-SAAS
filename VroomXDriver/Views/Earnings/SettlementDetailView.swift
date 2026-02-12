import SwiftUI
import UIKit

/// Detail view for a single settlement period showing trip-by-trip
/// financial breakdown with PDF and CSV export capabilities.
struct SettlementDetailView: View {
    let settlement: Settlement

    @State private var isGeneratingPDF = false
    @State private var isGeneratingCSV = false

    /// Per-trip net earnings (driver pay - expenses).
    private func tripNet(_ trip: VroomXTrip) -> Double {
        (trip.driverPay ?? 0) - (trip.totalExpenses ?? 0)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                headerSection
                summaryCard
                tripBreakdownTable
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(Color.appBackground)
        .navigationTitle("Settlement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        exportPDF()
                    } label: {
                        Label("Export PDF", systemImage: "doc.fill")
                    }

                    Button {
                        exportCSV()
                    } label: {
                        Label("Export CSV", systemImage: "tablecells")
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundColor(.brandPrimary)
                }
            }
        }
    }

    // MARK: - Header

    /// Period date range, total earnings, and trip count.
    private var headerSection: some View {
        VStack(spacing: 8) {
            Text(settlement.dateRange)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)

            Text(formatCurrency(settlement.totalDriverPay))
                .font(.system(size: 32, weight: .heavy).monospacedDigit())
                .foregroundColor(.textPrimary)

            Text("\(settlement.tripCount) trips")
                .font(.vroomxBodyBold)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Summary Card

    /// Five-row financial summary for the settlement period.
    private var summaryCard: some View {
        VStack(spacing: 0) {
            Text("Summary")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)

            summaryRow(label: "Gross Revenue", value: settlement.totalRevenue, color: .textPrimary)
            Divider()

            summaryRow(label: "Carrier Pay", value: totalCarrierPay, color: .textPrimary)
            Divider()

            summaryRow(label: "Driver Pay", value: settlement.totalDriverPay, color: .brandPrimary, highlight: true)
            Divider()

            summaryRow(label: "Total Expenses", value: settlement.totalExpenses, color: settlement.totalExpenses > 0 ? .brandDanger : .textSecondary)
            Divider()

            summaryRow(
                label: "Net Earnings",
                value: settlement.netEarnings,
                color: settlement.netEarnings >= 0 ? .brandSuccess : .brandDanger,
                highlight: true
            )
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// Total carrier pay across all trips.
    private var totalCarrierPay: Double {
        settlement.trips.compactMap(\.carrierPay).reduce(0, +)
    }

    /// A single row in the summary card.
    private func summaryRow(label: String, value: Double, color: Color, highlight: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(highlight ? .vroomxBodyBold : .vroomxBody)
                .foregroundColor(.textPrimary)

            Spacer()

            Text(formatCurrency(value))
                .font(highlight ? .system(size: 15, weight: .bold).monospacedDigit() : .vroomxMono)
                .foregroundColor(color)
        }
        .padding(.vertical, 10)
    }

    // MARK: - Trip Breakdown Table

    /// Trip-by-trip table with alternating row colors and a total row.
    private var tripBreakdownTable: some View {
        VStack(spacing: 0) {
            Text("Trip Breakdown")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)

            // Column headers
            tripTableHeader

            // Trip rows
            ForEach(Array(settlement.trips.enumerated()), id: \.element.id) { index, trip in
                tripTableRow(trip: trip, index: index)
            }

            // Totals row
            totalRow
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// Column header row for the trip table.
    private var tripTableHeader: some View {
        HStack(spacing: 4) {
            Text("Trip")
                .frame(width: 48, alignment: .leading)
            Text("Route")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Revenue")
                .frame(width: 68, alignment: .trailing)
            Text("Pay")
                .frame(width: 58, alignment: .trailing)
            Text("Net")
                .frame(width: 58, alignment: .trailing)
        }
        .font(.vroomxCaptionSmall)
        .foregroundColor(.textSecondary)
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
        .background(Color.textSecondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    /// A single trip row in the breakdown table.
    private func tripTableRow(trip: VroomXTrip, index: Int) -> some View {
        let net = tripNet(trip)
        let routeText = compactRoute(trip)

        return HStack(spacing: 4) {
            Text(trip.tripNumber ?? "#\(index + 1)")
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textPrimary)
                .frame(width: 48, alignment: .leading)
                .lineLimit(1)

            VStack(alignment: .leading, spacing: 1) {
                Text(routeText)
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.textPrimary)
                    .lineLimit(1)

                Text(tripDateFormatted(trip))
                    .font(.system(size: 9, weight: .regular))
                    .foregroundColor(.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(formatCompact(trip.totalRevenue ?? 0))
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textPrimary)
                .frame(width: 68, alignment: .trailing)

            Text(formatCompact(trip.driverPay ?? 0))
                .font(.vroomxCaptionSmall)
                .foregroundColor(.brandPrimary)
                .frame(width: 58, alignment: .trailing)

            Text(formatCompact(net))
                .font(.vroomxCaptionSmall)
                .foregroundColor(net >= 0 ? .brandSuccess : .brandDanger)
                .frame(width: 58, alignment: .trailing)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
        .background(index % 2 == 0 ? Color.clear : Color.textSecondary.opacity(0.04))
    }

    /// Totals row at the bottom of the trip table.
    private var totalRow: some View {
        HStack(spacing: 4) {
            Text("Total")
                .font(.vroomxCaptionSmall)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)
                .frame(width: 48, alignment: .leading)

            Text("\(settlement.tripCount) trips")
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(formatCompact(settlement.totalRevenue))
                .font(.vroomxCaptionSmall)
                .fontWeight(.bold)
                .foregroundColor(.textPrimary)
                .frame(width: 68, alignment: .trailing)

            Text(formatCompact(settlement.totalDriverPay))
                .font(.vroomxCaptionSmall)
                .fontWeight(.bold)
                .foregroundColor(.brandPrimary)
                .frame(width: 58, alignment: .trailing)

            Text(formatCompact(settlement.netEarnings))
                .font(.vroomxCaptionSmall)
                .fontWeight(.bold)
                .foregroundColor(settlement.netEarnings >= 0 ? .brandSuccess : .brandDanger)
                .frame(width: 58, alignment: .trailing)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
        .background(Color.textSecondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - Helpers

    /// Compact route string: "Origin -> Dest" truncated.
    private func compactRoute(_ trip: VroomXTrip) -> String {
        let origin = trip.originSummary ?? "Origin"
        let dest = trip.destinationSummary ?? "Dest"
        let compact = "\(origin) -> \(dest)"
        if compact.count > 28 {
            return String(compact.prefix(25)) + "..."
        }
        return compact
    }

    /// Format trip start_date as "MMM d" (e.g. "Feb 5").
    private func tripDateFormatted(_ trip: VroomXTrip) -> String {
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        guard let date = inputFormatter.date(from: trip.startDate) else { return trip.startDate }
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d"
        return displayFormatter.string(from: date)
    }

    /// Format a value as a compact currency string (e.g. "$1,234").
    private func formatCompact(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    /// Format a value as full currency string (e.g. "$1,234.56").
    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }

    // MARK: - PDF Export

    /// Generate a settlement PDF and present the share sheet.
    private func exportPDF() {
        isGeneratingPDF = true

        DispatchQueue.global(qos: .userInitiated).async {
            let pdfData = generatePDF()

            DispatchQueue.main.async {
                isGeneratingPDF = false
                sharePDFData(pdfData)
            }
        }
    }

    /// Generate a professional PDF settlement statement.
    private func generatePDF() -> Data {
        let pageWidth: CGFloat = 612 // US Letter
        let pageHeight: CGFloat = 792
        let margin: CGFloat = 50
        let contentWidth = pageWidth - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        let data = renderer.pdfData { context in
            context.beginPage()
            var yPos: CGFloat = margin

            // -- Header --
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 22, weight: .heavy),
                .foregroundColor: UIColor.label
            ]
            let title = "Settlement Statement"
            let titleStr = NSAttributedString(string: title, attributes: titleAttrs)
            titleStr.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 32

            // Branding
            let brandAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12, weight: .bold),
                .foregroundColor: UIColor.systemBlue
            ]
            let brandStr = NSAttributedString(string: "VroomX Driver App", attributes: brandAttrs)
            brandStr.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 20

            // Period dates
            let dateAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .medium),
                .foregroundColor: UIColor.secondaryLabel
            ]
            let dateStr = NSAttributedString(string: "Pay Period: \(settlement.dateRange)", attributes: dateAttrs)
            dateStr.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 20

            let genDateStr = NSAttributedString(
                string: "Generated: \(formattedTimestamp())",
                attributes: dateAttrs
            )
            genDateStr.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 32

            // -- Divider line --
            drawLine(context: context.cgContext, y: yPos, margin: margin, width: contentWidth)
            yPos += 16

            // -- Summary Section --
            let sectionAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 16, weight: .bold),
                .foregroundColor: UIColor.label
            ]
            let summaryTitle = NSAttributedString(string: "Summary", attributes: sectionAttrs)
            summaryTitle.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 24

            let labelAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12, weight: .regular),
                .foregroundColor: UIColor.label
            ]
            let valueAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold),
                .foregroundColor: UIColor.label
            ]
            let highlightAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .bold),
                .foregroundColor: UIColor.systemBlue
            ]

            let summaryRows: [(String, String, [NSAttributedString.Key: Any])] = [
                ("Gross Revenue:", formatCurrency(settlement.totalRevenue), valueAttrs),
                ("Carrier Pay:", formatCurrency(totalCarrierPay), valueAttrs),
                ("Driver Pay:", formatCurrency(settlement.totalDriverPay), highlightAttrs),
                ("Total Expenses:", formatCurrency(settlement.totalExpenses), valueAttrs),
                ("Net Earnings:", formatCurrency(settlement.netEarnings), highlightAttrs),
            ]

            for (label, value, attrs) in summaryRows {
                let labelStr = NSAttributedString(string: label, attributes: labelAttrs)
                let valueStr = NSAttributedString(string: value, attributes: attrs)
                labelStr.draw(at: CGPoint(x: margin, y: yPos))
                let valueWidth = valueStr.size().width
                valueStr.draw(at: CGPoint(x: margin + contentWidth - valueWidth, y: yPos))
                yPos += 20
            }
            yPos += 16

            // -- Divider line --
            drawLine(context: context.cgContext, y: yPos, margin: margin, width: contentWidth)
            yPos += 16

            // -- Trip Breakdown Section --
            let breakdownTitle = NSAttributedString(string: "Trip Breakdown", attributes: sectionAttrs)
            breakdownTitle.draw(at: CGPoint(x: margin, y: yPos))
            yPos += 24

            // Table headers
            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10, weight: .bold),
                .foregroundColor: UIColor.secondaryLabel
            ]

            let columns: [(String, CGFloat, NSTextAlignment)] = [
                ("Trip #", 60, .left),
                ("Date", 70, .left),
                ("Route", contentWidth - 310, .left),
                ("Revenue", 60, .right),
                ("Pay", 60, .right),
                ("Net", 60, .right),
            ]

            var xPos = margin
            for (header, width, alignment) in columns {
                let headerStr = NSAttributedString(string: header, attributes: headerAttrs)
                let headerWidth = headerStr.size().width
                let drawX: CGFloat
                switch alignment {
                case .right: drawX = xPos + width - headerWidth
                case .center: drawX = xPos + (width - headerWidth) / 2
                default: drawX = xPos
                }
                headerStr.draw(at: CGPoint(x: drawX, y: yPos))
                xPos += width
            }
            yPos += 18

            // Thin line below headers
            drawLine(context: context.cgContext, y: yPos, margin: margin, width: contentWidth, thin: true)
            yPos += 6

            // Trip rows
            let rowAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular),
                .foregroundColor: UIColor.label
            ]
            let rowLabelAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10, weight: .regular),
                .foregroundColor: UIColor.label
            ]

            let tripsPerPage = 15
            for (index, trip) in settlement.trips.enumerated() {
                // Check for page break
                if index > 0 && index % tripsPerPage == 0 {
                    // Footer on current page
                    drawFooter(context: context, pageWidth: pageWidth, pageHeight: pageHeight, margin: margin)
                    context.beginPage()
                    yPos = margin

                    // Re-draw section title and headers on new page
                    let contTitle = NSAttributedString(string: "Trip Breakdown (continued)", attributes: sectionAttrs)
                    contTitle.draw(at: CGPoint(x: margin, y: yPos))
                    yPos += 24

                    var headerX = margin
                    for (header, width, alignment) in columns {
                        let hStr = NSAttributedString(string: header, attributes: headerAttrs)
                        let hWidth = hStr.size().width
                        let drawX: CGFloat
                        switch alignment {
                        case .right: drawX = headerX + width - hWidth
                        case .center: drawX = headerX + (width - hWidth) / 2
                        default: drawX = headerX
                        }
                        hStr.draw(at: CGPoint(x: drawX, y: yPos))
                        headerX += width
                    }
                    yPos += 18
                    drawLine(context: context.cgContext, y: yPos, margin: margin, width: contentWidth, thin: true)
                    yPos += 6
                }

                let net = tripNet(trip)
                let route = compactRoute(trip)
                let tripNum = trip.tripNumber ?? "#\(index + 1)"
                let date = tripDateFormatted(trip)

                let rowData: [(String, CGFloat, NSTextAlignment, [NSAttributedString.Key: Any])] = [
                    (tripNum, 60, .left, rowLabelAttrs),
                    (date, 70, .left, rowLabelAttrs),
                    (route, contentWidth - 310, .left, rowLabelAttrs),
                    (formatCurrency(trip.totalRevenue ?? 0), 60, .right, rowAttrs),
                    (formatCurrency(trip.driverPay ?? 0), 60, .right, rowAttrs),
                    (formatCurrency(net), 60, .right, rowAttrs),
                ]

                var rowX = margin
                for (text, width, alignment, attrs) in rowData {
                    let cellStr = NSAttributedString(string: text, attributes: attrs)
                    let cellWidth = cellStr.size().width
                    let drawX: CGFloat
                    switch alignment {
                    case .right: drawX = rowX + width - cellWidth
                    case .center: drawX = rowX + (width - cellWidth) / 2
                    default: drawX = rowX
                    }
                    cellStr.draw(at: CGPoint(x: drawX, y: yPos))
                    rowX += width
                }
                yPos += 18
            }

            // Total row
            yPos += 4
            drawLine(context: context.cgContext, y: yPos, margin: margin, width: contentWidth, thin: true)
            yPos += 6

            let boldRowAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 10, weight: .bold),
                .foregroundColor: UIColor.label
            ]
            let boldLabelAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10, weight: .bold),
                .foregroundColor: UIColor.label
            ]

            let totalData: [(String, CGFloat, NSTextAlignment, [NSAttributedString.Key: Any])] = [
                ("TOTAL", 60, .left, boldLabelAttrs),
                ("", 70, .left, boldLabelAttrs),
                ("\(settlement.tripCount) trips", contentWidth - 310, .left, boldLabelAttrs),
                (formatCurrency(settlement.totalRevenue), 60, .right, boldRowAttrs),
                (formatCurrency(settlement.totalDriverPay), 60, .right, boldRowAttrs),
                (formatCurrency(settlement.netEarnings), 60, .right, boldRowAttrs),
            ]

            var totalX = margin
            for (text, width, alignment, attrs) in totalData {
                let cellStr = NSAttributedString(string: text, attributes: attrs)
                let cellWidth = cellStr.size().width
                let drawX: CGFloat
                switch alignment {
                case .right: drawX = totalX + width - cellWidth
                case .center: drawX = totalX + (width - cellWidth) / 2
                default: drawX = totalX
                }
                cellStr.draw(at: CGPoint(x: drawX, y: yPos))
                totalX += width
            }

            // Footer
            drawFooter(context: context, pageWidth: pageWidth, pageHeight: pageHeight, margin: margin)
        }

        return data
    }

    /// Draw a horizontal separator line.
    private func drawLine(context: CGContext, y: CGFloat, margin: CGFloat, width: CGFloat, thin: Bool = false) {
        context.setStrokeColor(UIColor.separator.cgColor)
        context.setLineWidth(thin ? 0.5 : 1.0)
        context.move(to: CGPoint(x: margin, y: y))
        context.addLine(to: CGPoint(x: margin + width, y: y))
        context.strokePath()
    }

    /// Draw footer text at the bottom of the current page.
    private func drawFooter(context: UIGraphicsPDFRendererContext, pageWidth: CGFloat, pageHeight: CGFloat, margin: CGFloat) {
        let footerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .regular),
            .foregroundColor: UIColor.tertiaryLabel
        ]
        let footerText = "Generated by VroomX Driver App - \(formattedTimestamp())"
        let footerStr = NSAttributedString(string: footerText, attributes: footerAttrs)
        let footerWidth = footerStr.size().width
        footerStr.draw(at: CGPoint(x: (pageWidth - footerWidth) / 2, y: pageHeight - margin + 10))
    }

    /// Present the PDF data via share sheet.
    private func sharePDFData(_ data: Data) {
        let fileName = "VroomX_Settlement_\(settlement.payPeriodStart)_\(settlement.payPeriodEnd).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try data.write(to: tempURL)
            shareFile(url: tempURL)
        } catch {
            print("[SettlementDetailView] Failed to write PDF: \(error)")
        }
    }

    // MARK: - CSV Export

    /// Generate a CSV file and present the share sheet.
    private func exportCSV() {
        isGeneratingCSV = true

        var csv = "Trip Number,Date,Route,Revenue,Driver Pay,Expenses,Net\n"

        for (index, trip) in settlement.trips.enumerated() {
            let net = tripNet(trip)
            let tripNum = trip.tripNumber ?? "#\(index + 1)"
            let date = trip.startDate
            let route = "\"\(compactRoute(trip))\""
            let revenue = String(format: "%.2f", trip.totalRevenue ?? 0)
            let pay = String(format: "%.2f", trip.driverPay ?? 0)
            let expenses = String(format: "%.2f", trip.totalExpenses ?? 0)
            let netStr = String(format: "%.2f", net)

            csv += "\(tripNum),\(date),\(route),\(revenue),\(pay),\(expenses),\(netStr)\n"
        }

        // Total row
        let totalNet = String(format: "%.2f", settlement.netEarnings)
        csv += "TOTAL,,\(settlement.tripCount) trips,"
        csv += "\(String(format: "%.2f", settlement.totalRevenue)),"
        csv += "\(String(format: "%.2f", settlement.totalDriverPay)),"
        csv += "\(String(format: "%.2f", settlement.totalExpenses)),"
        csv += "\(totalNet)\n"

        let fileName = "VroomX_Settlement_\(settlement.payPeriodStart)_\(settlement.payPeriodEnd).csv"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try csv.write(to: tempURL, atomically: true, encoding: .utf8)
            isGeneratingCSV = false
            shareFile(url: tempURL)
        } catch {
            isGeneratingCSV = false
            print("[SettlementDetailView] Failed to write CSV: \(error)")
        }
    }

    // MARK: - Share Sheet

    /// Present a UIActivityViewController with the given file URL.
    private func shareFile(url: URL) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else { return }

        let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)

        // iPad popover support
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = rootVC.view
            popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }

        rootVC.present(activityVC, animated: true)
    }

    /// Current timestamp formatted for display in documents.
    private func formattedTimestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy 'at' h:mm a"
        return formatter.string(from: Date())
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SettlementDetailView(
            settlement: Settlement(
                payPeriodStart: "2026-01-27",
                payPeriodEnd: "2026-02-09",
                trips: []
            )
        )
    }
}
