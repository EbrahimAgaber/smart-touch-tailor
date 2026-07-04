const { hashXML } = require('../electron/zatca_phase2_impl.cjs');
const xml1 = `<Invoice><cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">Hello</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference></Invoice>`;
const xml2 = `<Invoice><cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">World</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference></Invoice>`;
const xml3 = `<Invoice></Invoice>`;
console.log('H1:', hashXML(xml1));
console.log('H2:', hashXML(xml2));
console.log('H3:', hashXML(xml3));
