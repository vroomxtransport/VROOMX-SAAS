import UIKit

// MARK: - PDF Generator Utilities

/// Shared PDF drawing utilities used by BOLGenerator and SettlementDetailView.
/// All methods operate on the current UIGraphics PDF context.
enum PDFGenerator {

    // MARK: - Page Constants

    /// US Letter size in points (72 dpi).
    static let letterWidth: CGFloat = 612
    static let letterHeight: CGFloat = 792

    /// Standard page margins.
    static let marginLeft: CGFloat = 40
    static let marginRight: CGFloat = 40
    static let marginTop: CGFloat = 40
    static let marginBottom: CGFloat = 40

    /// Usable content width.
    static var contentWidth: CGFloat {
        letterWidth - marginLeft - marginRight
    }

    // MARK: - Fonts

    static let titleFont = UIFont.systemFont(ofSize: 16, weight: .bold)
    static let headerFont = UIFont.systemFont(ofSize: 11, weight: .semibold)
    static let bodyFont = UIFont.systemFont(ofSize: 9, weight: .regular)
    static let bodyBoldFont = UIFont.systemFont(ofSize: 9, weight: .semibold)
    static let smallFont = UIFont.systemFont(ofSize: 7, weight: .regular)

    // MARK: - Colors

    static let brandBlue = UIColor(red: 59/255, green: 130/255, blue: 246/255, alpha: 1)
    static let darkGray = UIColor(red: 31/255, green: 41/255, blue: 55/255, alpha: 1)
    static let mediumGray = UIColor(red: 107/255, green: 114/255, blue: 128/255, alpha: 1)
    static let lightGray = UIColor(red: 229/255, green: 231/255, blue: 235/255, alpha: 1)
    static let veryLightGray = UIColor(red: 243/255, green: 244/255, blue: 246/255, alpha: 1)

    // MARK: - Text Drawing

    /// Draws text at a given point and returns the bounding rect used.
    @discardableResult
    static func drawText(
        _ text: String,
        at point: CGPoint,
        font: UIFont,
        color: UIColor,
        maxWidth: CGFloat? = nil
    ) -> CGRect {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]

        let constraintSize = CGSize(
            width: maxWidth ?? contentWidth,
            height: .greatestFiniteMagnitude
        )

        let boundingRect = (text as NSString).boundingRect(
            with: constraintSize,
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attributes,
            context: nil
        )

        let drawRect = CGRect(
            origin: point,
            size: CGSize(width: constraintSize.width, height: boundingRect.height)
        )

        (text as NSString).draw(in: drawRect, withAttributes: attributes)

        return CGRect(origin: point, size: boundingRect.size)
    }

    /// Draws right-aligned text and returns the bounding rect.
    @discardableResult
    static func drawTextRight(
        _ text: String,
        at point: CGPoint,
        font: UIFont,
        color: UIColor,
        maxWidth: CGFloat? = nil
    ) -> CGRect {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]

        let textSize = (text as NSString).size(withAttributes: attributes)
        let width = maxWidth ?? contentWidth
        let rightAlignedX = point.x + width - textSize.width
        let drawPoint = CGPoint(x: rightAlignedX, y: point.y)

        (text as NSString).draw(at: drawPoint, withAttributes: attributes)

        return CGRect(origin: drawPoint, size: textSize)
    }

    // MARK: - Shape Drawing

    /// Draws a horizontal line.
    static func drawLine(
        from start: CGPoint,
        to end: CGPoint,
        color: UIColor,
        width: CGFloat = 0.5
    ) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        context.saveGState()
        context.setStrokeColor(color.cgColor)
        context.setLineWidth(width)
        context.move(to: start)
        context.addLine(to: end)
        context.strokePath()
        context.restoreGState()
    }

    /// Draws a rectangle with optional fill and stroke.
    static func drawRect(
        _ rect: CGRect,
        fill: UIColor? = nil,
        stroke: UIColor? = nil,
        strokeWidth: CGFloat = 0.5,
        cornerRadius: CGFloat = 0
    ) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        context.saveGState()

        let path: CGPath
        if cornerRadius > 0 {
            path = UIBezierPath(roundedRect: rect, cornerRadius: cornerRadius).cgPath
        } else {
            path = UIBezierPath(rect: rect).cgPath
        }

        if let fill {
            context.setFillColor(fill.cgColor)
            context.addPath(path)
            context.fillPath()
        }

        if let stroke {
            context.setStrokeColor(stroke.cgColor)
            context.setLineWidth(strokeWidth)
            context.addPath(path)
            context.strokePath()
        }

        context.restoreGState()
    }

    // MARK: - Image Drawing

    /// Draws an image scaled to fit within the given rect, maintaining aspect ratio.
    static func drawImage(_ image: UIImage, in rect: CGRect) {
        let imageAspect = image.size.width / image.size.height
        let rectAspect = rect.width / rect.height

        var drawRect = rect
        if imageAspect > rectAspect {
            // Image is wider - fit to width
            let height = rect.width / imageAspect
            drawRect = CGRect(
                x: rect.origin.x,
                y: rect.origin.y + (rect.height - height) / 2,
                width: rect.width,
                height: height
            )
        } else {
            // Image is taller - fit to height
            let width = rect.height * imageAspect
            drawRect = CGRect(
                x: rect.origin.x + (rect.width - width) / 2,
                y: rect.origin.y,
                width: width,
                height: rect.height
            )
        }

        image.draw(in: drawRect)
    }

    /// Downloads and draws a signature image from a storage path.
    /// Falls back to a placeholder line with label if download fails.
    static func drawSignature(
        _ storagePath: String?,
        signatureImage: UIImage?,
        in rect: CGRect,
        label: String
    ) {
        // Label above the signature area
        drawText(label, at: CGPoint(x: rect.minX, y: rect.minY), font: smallFont, color: mediumGray)

        let signatureRect = CGRect(
            x: rect.minX,
            y: rect.minY + 10,
            width: rect.width,
            height: rect.height - 10
        )

        // Draw signature box
        drawRect(signatureRect, fill: veryLightGray, stroke: lightGray)

        if let image = signatureImage {
            // Draw the in-memory signature image
            let inset = signatureRect.insetBy(dx: 4, dy: 4)
            drawImage(image, in: inset)
        } else {
            // Placeholder line
            let lineY = signatureRect.maxY - 8
            drawLine(
                from: CGPoint(x: signatureRect.minX + 8, y: lineY),
                to: CGPoint(x: signatureRect.maxX - 8, y: lineY),
                color: lightGray,
                width: 1
            )
        }
    }

    // MARK: - Table Drawing

    /// Draws a table row with alternating background.
    static func drawTableRow(
        columns: [(text: String, width: CGFloat)],
        at y: CGFloat,
        height: CGFloat = 16,
        font: UIFont = bodyFont,
        color: UIColor = darkGray,
        isAlternate: Bool = false,
        isHeader: Bool = false
    ) {
        let rowRect = CGRect(x: marginLeft, y: y, width: contentWidth, height: height)

        if isHeader {
            drawRect(rowRect, fill: brandBlue)
        } else if isAlternate {
            drawRect(rowRect, fill: veryLightGray)
        }

        var x = marginLeft + 4
        let textColor = isHeader ? .white : color
        let textFont = isHeader ? bodyBoldFont : font

        for (text, width) in columns {
            drawText(text, at: CGPoint(x: x, y: y + 3), font: textFont, color: textColor, maxWidth: width - 8)
            x += width
        }
    }
}
