import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import {
  generateLineChart,
  generateBarChart,
} from "../../lib/pdfCharts";
import { withAuth } from "../../lib/withAuth";

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      totalEarnings,
      totalDonations,
      projectCount,
      topProject,
      earningsByDate,
      fundingByProject,
      donorsByProject,
    } = req.body;

    /* ---------- INPUT VALIDATION ---------- */
    if (typeof totalEarnings === "undefined") {
      return res.status(400).json({ error: "totalEarnings is required" });
    }
    if (typeof totalDonations === "undefined") {
      return res.status(400).json({ error: "totalDonations is required" });
    }
    if (typeof projectCount === "undefined") {
      return res.status(400).json({ error: "projectCount is required" });
    }
    if (!topProject && topProject !== "") {
      return res.status(400).json({ error: "topProject is required" });
    }
    if (!Array.isArray(earningsByDate)) {
      return res.status(400).json({ error: "earningsByDate must be an array" });
    }
    if (!Array.isArray(fundingByProject)) {
      return res.status(400).json({ error: "fundingByProject must be an array" });
    }
    if (!Array.isArray(donorsByProject)) {
      return res.status(400).json({ error: "donorsByProject must be an array" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=fundora-premium-report.pdf"
    );

    doc.pipe(res);

    /* ---------------- LOGO ---------------- */
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 70 });
    }

    /* ---------------- WATERMARK ---------------- */
    doc.opacity(0.05);
    doc.fontSize(80).text("FUNDORA", 150, 300, { rotate: 45 });
    doc.opacity(1);

    doc.moveDown(2);

    /* ---------------- HEADER ---------------- */
    doc
      .fontSize(26)
      .fillColor("#2563eb")
      .text("Creator Analytics Report", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(12)
      .fillColor("#555")
      .text(`Generated: ${new Date().toLocaleString()}`, {
        align: "center",
      });

    doc.moveDown(2);

    /* ---------------- SUMMARY BOX ---------------- */
    doc.fillColor("#000").fontSize(18).text("Summary");

    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Total Earnings: ₹${totalEarnings}`);
    doc.text(`Total Donations: ${totalDonations}`);
    doc.text(`Projects Created: ${projectCount}`);
    doc.text(`Top Project: ${topProject}`);

    doc.moveDown(2);

    /* ---------------- TABLE ---------------- */
    doc.fontSize(18).text("Project Funding Table");
    doc.moveDown();

    fundingByProject.forEach((p, i) => {
      doc.fontSize(12).text(`${i + 1}. ${p.name} — ₹${p.amount}`);
    });

    /* ---------------- PAGE BREAK ---------------- */
    doc.addPage();

    /* ---------------- CHART 1 ---------------- */
    doc.fontSize(18).text("Earnings Over Time");

    const lineChart = await generateLineChart(earningsByDate);
    doc.image(lineChart, { width: 500 });

    doc.addPage();

    /* ---------------- CHART 2 ---------------- */
    doc.fontSize(18).text("Funding by Project");

    const barChart = await generateBarChart(
      fundingByProject,
      "Funding"
    );

    doc.image(barChart, { width: 500 });

    doc.addPage();

    /* ---------------- CHART 3 ---------------- */
    doc.fontSize(18).text("Donors by Project");

    const donorsChart = await generateBarChart(
      donorsByProject,
      "Donors"
    );

    doc.image(donorsChart, { width: 500 });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF failed" });
  }
});
