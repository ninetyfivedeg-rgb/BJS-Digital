import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Helper to convert any image inside an HTML element into an inline Base64 data URL
 * to avoid canvas tainting and cross-origin security errors in html2canvas.
 */
async function inlineImagesToDataUrls(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('data:')) return;
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              img.src = reader.result;
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Failed to inline image for PDF export:', e);
      }
    })
  );
}

/**
 * Dedicated reliable printing and PDF download engine for BJS Digital.
 * Generates and downloads real .pdf files directly without popup blocker or iframe sandbox restrictions.
 */
export async function downloadPdfFromHtml(htmlContent: string, filename: string = 'Dokumen_KSP_BJS.pdf') {
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Show temporary toast notification for user feedback
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.backgroundColor = '#0f172a';
  toast.style.color = '#ffffff';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
  toast.style.zIndex = '9999999';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = 'bold';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.innerHTML = `
    <svg class="animate-spin" style="width: 16px; height: 16px; animation: spin 1s linear infinite;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>Menyiapkan dan mengunduh berkas PDF resmi...</span>
  `;
  document.body.appendChild(toast);

  // Create an in-viewport off-screen container with low opacity so html2canvas renders perfectly
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '794px'; // Standard A4 width at 96 DPI
  container.style.minHeight = '1123px';
  container.style.zIndex = '9999998';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.opacity = '0.01'; // Invisible to user while active
  container.style.pointerEvents = 'none';

  const styledHtml = `
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
      .header-kop { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
      .header-kop h1 { font-size: 16px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; }
      .header-kop h2 { font-size: 14px; font-weight: 800; margin: 0 0 4px 0; color: #7f1d1d; text-transform: uppercase; }
      .header-kop p { font-size: 11px; color: #475569; margin: 0; }
      .document-title { text-align: center; font-size: 15px; font-weight: 900; text-decoration: underline; margin: 15px 0 5px 0; text-transform: uppercase; color: #0f172a; }
      .doc-number { text-align: center; font-family: monospace; font-size: 11px; color: #475569; margin-bottom: 15px; }
      .content-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      td, th { padding: 6px 8px; vertical-align: middle; }
      td.label { color: #475569; width: 38%; }
      td.colon { width: 2%; text-align: center; }
      td.value { font-weight: 700; color: #0f172a; }
      .signatures { margin-top: 35px; display: flex; justify-content: space-between; text-align: center; }
      .signature-col { width: 45%; }
      .signature-space { height: 50px; }
      .signature-name { font-weight: 800; border-top: 1px solid #94a3b8; padding-top: 4px; display: inline-block; min-width: 150px; }
      .signature-role { font-size: 11px; color: #475569; }
      .footer-note { margin-top: 25px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #64748b; text-align: center; }
    </style>
    <div>${htmlContent}</div>
  `;

  container.innerHTML = styledHtml;
  document.body.appendChild(container);

  try {
    // 1. Inline all images to Base64 to prevent canvas tainting
    await inlineImagesToDataUrls(container);

    // 2. Wait for images to load
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 800);
            }
          })
      )
    );

    // 3. Render container to canvas with allowTaint: false
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    // Trigger download
    savePdfDirectly(pdf, cleanFilename);

    toast.innerHTML = `
      <svg style="width: 16px; height: 16px; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>PDF berhasil diunduh (${cleanFilename})</span>
    `;
    setTimeout(() => {
      if (document.body.contains(toast)) document.body.removeChild(toast);
    }, 2500);
  } catch (error) {
    console.error('html2canvas rendering failed, using direct jsPDF fallback:', error);
    try {
      // Direct jsPDF fallback that guarantees a downloaded PDF document
      const fallbackPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Strip tags to get clean text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const plainText = tempDiv.innerText || tempDiv.textContent || '';
      const lines = plainText.split('\n').filter((l) => l.trim().length > 0);

      fallbackPdf.setFont('helvetica', 'bold');
      fallbackPdf.setFontSize(14);
      fallbackPdf.text('KOPERASI BRAMA JAYA SEJAHTERA (BJS DIGITAL)', 105, 20, { align: 'center' });
      fallbackPdf.setFontSize(10);
      fallbackPdf.setFont('helvetica', 'normal');
      fallbackPdf.text('Badan Hukum No: AHU-0018942.AH.01.26.TAHUN 2023', 105, 26, { align: 'center' });
      fallbackPdf.line(15, 30, 195, 30);

      let y = 38;
      fallbackPdf.setFontSize(9);
      for (const line of lines) {
        if (y > 280) {
          fallbackPdf.addPage();
          y = 20;
        }
        fallbackPdf.text(line.trim(), 15, y);
        y += 6;
      }

      savePdfDirectly(fallbackPdf, cleanFilename);

      toast.innerHTML = `
        <svg style="width: 16px; height: 16px; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>PDF berhasil diunduh (${cleanFilename})</span>
      `;
      setTimeout(() => {
        if (document.body.contains(toast)) document.body.removeChild(toast);
      }, 2500);
    } catch (fallbackErr) {
      console.error('All PDF generation methods failed:', fallbackErr);
      if (document.body.contains(toast)) document.body.removeChild(toast);
      fallbackPrint(htmlContent, filename);
    }
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function savePdfDirectly(pdf: jsPDF, cleanFilename: string) {
  try {
    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch {
    pdf.save(cleanFilename);
  }
}

/**
 * Universal print and PDF download function
 */
export function printHtmlContent(htmlContent: string, title: string = 'Dokumen KSP BJS Digital') {
  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  downloadPdfFromHtml(htmlContent, safeFilename);
}

function fallbackPrint(htmlContent: string, title: string) {
  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head><title>${title}</title></head>
          <body>${htmlContent}</body>
        </html>
      `);
      frameDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) document.body.removeChild(printFrame);
          }, 1000);
        }
      }, 300);
    }
  } catch {
    window.print();
  }
}
