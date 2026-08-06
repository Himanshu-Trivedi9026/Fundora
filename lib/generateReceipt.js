import jsPDF from "jspdf";

export async function generateReceipt(receipt) {
  try {
    const doc = new jsPDF();

    /* 🔥 LOAD LOGO (SAFE) */
    let logoBase64 = null;

    try {
      const logoBlob = await fetch("/logo.png").then((res) => res.blob());

      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(logoBlob);
      });
    } catch (err) {
      console.warn("Logo load failed:", err);
    }

    /* 🔷 HEADER */
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 15, 10, 25, 25);
    }

    doc.setFontSize(18);
    doc.text("Fundora", 45, 25);

    doc.setFontSize(10);
    doc.text("Fund ideas. Fuel innovation. Empower creators.", 45, 32);

    doc.line(15, 38, 195, 38);

    doc.setFontSize(16);
    doc.text("Payment Receipt", 15, 50);

    /* 🔥 DATA */
    let y = 65;

    const row = (label, value) => {
      doc.text(`${label}:`, 15, y);
      doc.setFont(undefined, "bold");
      doc.text(String(value || "-"), 70, y);
      doc.setFont(undefined, "normal");
      y += 10;
    };

    row("Receipt ID", receipt?.receiptId);
    row("Project", receipt?.project);
    row("Amount", `Rs. ${Number(receipt?.amount || 0)}`);
    row("Donor", receipt?.donor);
    row("Date", receipt?.date);

    y += 10;
    doc.text("Thank you for supporting this project on Fundora.", 15, y);

    /* 🔥 CRITICAL FIX */
    const blob = doc.output("blob");

    return blob;
  } catch (err) {
    console.error("PDF generation failed:", err);
    return null; // 🔥 prevent crash
  }
}
