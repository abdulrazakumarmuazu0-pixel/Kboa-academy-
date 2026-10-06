// ============================================
// KBOA - Certificate Generation System
// ============================================

// Generate Certificate
async function generateCertificate(studentId, courseId, courseName, score, resultId) {
    try {
        if (!resultId) throw new Error('A verified exam result is required to issue a certificate.');
        const result = await kboaCallFunction('issueCertificate', { resultId: resultId });
        const certId = result.certificateId;
        const certSnapshot = await db.collection('certificates').doc(certId).get();
        if (!certSnapshot.exists) throw new Error('Certificate was issued but could not be loaded.');
        const certificateData = Object.assign({ id: certSnapshot.id }, certSnapshot.data());
        console.log('Certificate issued:', certId);
        return certificateData;
    } catch (error) {
        console.error('Error issuing certificate:', error);
        throw error;
    }
}

// Generate Unique Certificate ID
function generateCertificateId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999);
    return `KBOA-${year}-${String(random).padStart(6, '0')}`;
}

// Display Certificate
function displayCertificate(certificateData) {
    const container = document.getElementById('certificate-container');
    if (!container) return;

    container.innerHTML = `
        <div class="certificate" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            color: white;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <div style="background: white; padding: 40px; border-radius: 10px; color: #333;">
                <!-- Header -->
                <div style="margin-bottom: 30px;">
                    <img src="assets/images/logo.png" alt="KBOA Logo" style="width: 80px; height: 80px; margin-bottom: 15px;">
                    <h1 style="color: #2563eb; font-size: 2rem; margin-bottom: 5px;">Knowledge Bridge Online Academy</h1>
                    <p style="color: #666; font-size: 0.9rem;">Certificate of Completion</p>
                </div>

                <!-- Certificate Title -->
                <div style="margin: 30px 0;">
                    <h2 style="font-size: 1.5rem; color: #333; margin-bottom: 10px;">This is to certify that</h2>
                    <h1 style="font-size: 2.5rem; color: #2563eb; font-weight: 800; margin: 20px 0; text-transform: uppercase;">
                        ${certificateData.studentName}
                    </h1>
                    <h2 style="font-size: 1.2rem; color: #666;">has successfully completed the course</h2>
                    <h2 style="font-size: 1.8rem; color: #333; font-weight: 700; margin: 15px 0;">
                        ${certificateData.courseName}
                    </h2>
                </div>

                <!-- Score -->
                <div style="margin: 30px 0; padding: 20px; background: #f0f9ff; border-radius: 10px;">
                    <div style="font-size: 3rem; font-weight: 800; color: #2563eb;">
                        ${certificateData.score}%
                    </div>
                    <div style="color: #666; margin-top: 5px;">Final Score</div>
                </div>

                <!-- Details -->
                <div style="display: flex; justify-content: space-between; margin-top: 40px; flex-wrap: wrap; gap: 20px;">
                    <div style="text-align: left;">
                        <p style="color: #666; font-size: 0.85rem; margin-bottom: 5px;">Certificate ID</p>
                        <p style="font-weight: 700; color: #333; font-family: monospace;">${certificateData.certificateId}</p>
                    </div>
                    <div style="text-align: center;">
                        <div id="qrcode" style="width: 100px; height: 100px; margin: 0 auto;"></div>
                        <p style="color: #666; font-size: 0.75rem; margin-top: 5px;">Scan to Verify</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="color: #666; font-size: 0.85rem; margin-bottom: 5px;">Date of Completion</p>
                        <p style="font-weight: 700; color: #333;">${formatDate(certificateData.completionDate)}</p>
                    </div>
                </div>

                <!-- Signatures -->
                <div style="display: flex; justify-content: space-between; margin-top: 50px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                    <div style="text-align: center;">
                        <div style="width: 150px; border-bottom: 2px solid #333; margin-bottom: 10px; height: 40px;"></div>
                        <p style="font-weight: 600; color: #333;">Program Director</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 150px; border-bottom: 2px solid #333; margin-bottom: 10px; height: 40px;"></div>
                        <p style="font-weight: 600; color: #333;">Chief Instructor</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div style="text-align: center; margin-top: 30px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="downloadCertificate('${certificateData.certificateId}')">
                📥 Download Certificate
            </button>
            <button class="btn btn-outline" onclick="shareCertificate('${certificateData.certificateId}')">
                🔗 Share Certificate
            </button>
            <button class="btn btn-outline" onclick="verifyCertificate('${certificateData.certificateId}')">
                🔍 Verify Online
            </button>
        </div>
    `;

    // Generate QR Code
    generateQRCode(certificateData);
}

// Generate QR Code
function generateQRCode(certificateData) {
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;

    // Use QRCode.js library or API
    const qrData = `https://kboa.edu.ng/verify-certificate.html?id=${certificateData.certificateId}`;

    // Simple QR Code using API (in production, use a proper QR library)
    qrContainer.innerHTML = `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}" 
             alt="QR Code" style="width: 100%; height: 100%;">
    `;
}

// Download Certificate as PDF
function downloadCertificate(certId) {
    // Use html2canvas and jsPDF to generate PDF
    const certificate = document.querySelector('.certificate');

    if (typeof html2canvas === 'undefined') {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function() {
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function() {
                generatePDF(certificate, certId);
            });
        });
    } else {
        generatePDF(certificate, certId);
    }
}

// Generate PDF
function generatePDF(element, certId) {
    html2canvas(element, { scale: 2 }).then(function(canvas) {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`KBOA-Certificate-${certId}.pdf`);
    });
}

// Share Certificate
function shareCertificate(certId) {
    const shareUrl = `https://kboa.edu.ng/verify-certificate.html?id=${certId}`;

    if (navigator.share) {
        navigator.share({
            title: 'My KBOA Certificate',
            text: 'I just earned a certificate from Knowledge Bridge Online Academy!',
            url: shareUrl
        }).catch(function(error) {
            console.log('Error sharing:', error);
        });
    } else {
        // Fallback - copy to clipboard
        copyToClipboard(shareUrl);
        alert('Certificate link copied to clipboard!');
    }
}

// Verify Certificate Online
function verifyCertificate(certId) {
    window.open(`verify-certificate.html?id=${certId}`, '_blank');
}

// Copy to Clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Load Script Dynamically
function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
}

// Verify Certificate from Database
async function verifyCertificateFromDB(certId) {
    try {
        const result = await kboaCallFunction('verifyCertificate', { certificateId: certId });
        return result && result.valid
            ? { valid: true, data: result }
            : { valid: false, message: 'Certificate not found' };
    } catch (error) {
        console.error('Verification error:', error);
        return { valid: false, message: 'Error verifying certificate' };
    }
}

// Get Student Certificates
async function getStudentCertificates(studentId) {
    try {
        const certsSnapshot = await db.collection('certificates')
            .where('studentId', '==', studentId)
            .orderBy('createdAt', 'desc')
            .get();

        const certificates = [];
        certsSnapshot.forEach(function(doc) {
            certificates.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return certificates;
    } catch (error) {
        console.error('Error fetching certificates:', error);
        return [];
    }
}

// Display Certificates List
function displayCertificatesList(certificates) {
    const container = document.getElementById('certificates-list');
    if (!container) return;

    if (certificates.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-500);">
                <p style="font-size: 3rem; margin-bottom: 15px;">🏆</p>
                <h3>No Certificates Yet</h3>
                <p>Complete courses to earn certificates</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    certificates.forEach(function(cert) {
        const certCard = document.createElement('div');
        certCard.className = 'certificate-card';
        certCard.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        `;

        certCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                ">
                    🏆
                </div>
                <div>
                    <h4 style="margin-bottom: 5px; color: var(--gray-900);">${cert.courseName}</h4>
                    <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 3px;">
                        ID: ${cert.certificateId}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--gray-500);">
                        Completed: ${formatDate(cert.completionDate)}
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-sm btn-outline" onclick="viewCertificate('${cert.certificateId}')">
                    👁️ View
                </button>
                <button class="btn btn-sm btn-primary" onclick="downloadCertificate('${cert.certificateId}')">
                    📥 Download
                </button>
                <button class="btn btn-sm btn-outline" onclick="shareCertificate('${cert.certificateId}')">
                    🔗 Share
                </button>
            </div>
        `;

        container.appendChild(certCard);
    });
}

// View Certificate
async function viewCertificate(certId) {
    const result = await verifyCertificateFromDB(certId);

    if (result.valid) {
        displayCertificate(result.data);

        // Scroll to certificate
        document.getElementById('certificate-container')?.scrollIntoView({ behavior: 'smooth' });
    } else {
        alert('Certificate not found or invalid');
    }
}

// Make functions globally available
window.generateCertificate = generateCertificate;
window.displayCertificate = displayCertificate;
window.downloadCertificate = downloadCertificate;
window.shareCertificate = shareCertificate;
window.verifyCertificate = verifyCertificate;
window.getStudentCertificates = getStudentCertificates;
window.displayCertificatesList = displayCertificatesList;
window.viewCertificate = viewCertificate;
