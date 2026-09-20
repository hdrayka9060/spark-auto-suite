import { fileUrl } from "@/lib/api";

export type DocKind = "upload" | "signable";
export type DocStatus = "uploaded" | "pending" | "signed" | "void";
export type SignatureAnchor = "bottom-right" | "bottom-left" | "bottom-center";

export interface ServerDocSignature {
  signerName?: string;
  signedAt?: string;
  signedByStaffName?: string;
  signatureImageUrl?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ServerBuyerDocument {
  _id: string;
  buyerLeadId: string;
  leadId?: string;
  vehicleId?: string;
  kind: DocKind;
  title: string;
  docType?: string;
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  templateId?: string;
  templateName?: string;
  status: DocStatus;
  signedFileUrl?: string;
  signature?: ServerDocSignature;
  notes?: string;
  uploadedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerDoc {
  id: string;
  buyerLeadId: string;
  leadId?: string;
  kind: DocKind;
  title: string;
  docType: string;
  fileName: string;
  fileMime: string;
  status: DocStatus;
  templateName?: string;
  /** Absolute URL to open (signed copy if present, else original). */
  viewUrl: string;
  signedFileUrl?: string;
  signature?: ServerDocSignature;
  uploadedByName?: string;
  createdAt?: string;
}

export interface ServerDocTemplate {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  sourceType: "pdf" | "image";
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  signaturePage?: number;
  signatureAnchor?: SignatureAnchor;
  requireSignerName?: boolean;
  isActive?: boolean;
  createdByName?: string;
  createdAt?: string;
}

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceType: "pdf" | "image";
  fileUrl: string;
  fileName: string;
  signaturePage: number;
  signatureAnchor: SignatureAnchor;
  requireSignerName: boolean;
  isActive: boolean;
  createdByName?: string;
  createdAt?: string;
}

/** Human labels for the document-type dropdown. */
export const DOC_TYPES: { value: string; label: string }[] = [
  { value: "drivers_license", label: "Driver's License" },
  { value: "insurance", label: "Insurance" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "other", label: "Other" },
];

export const docTypeLabel = (v?: string): string =>
  DOC_TYPES.find((d) => d.value === v)?.label ?? "Other";

export function toBuyerDoc(s: ServerBuyerDocument): BuyerDoc {
  const raw = s.signedFileUrl || s.fileUrl || "";
  return {
    id: s._id,
    buyerLeadId: String(s.buyerLeadId),
    leadId: s.leadId ? String(s.leadId) : undefined,
    kind: s.kind,
    title: s.title,
    docType: s.docType || "other",
    fileName: s.fileName || "",
    fileMime: s.fileMime || "",
    status: s.status,
    templateName: s.templateName,
    viewUrl: fileUrl(raw),
    signedFileUrl: s.signedFileUrl ? fileUrl(s.signedFileUrl) : undefined,
    signature: s.signature,
    uploadedByName: s.uploadedByName,
    createdAt: s.createdAt,
  };
}

export function toDocTemplate(s: ServerDocTemplate): DocTemplate {
  return {
    id: s._id,
    name: s.name,
    description: s.description ?? "",
    category: s.category ?? "general",
    sourceType: s.sourceType,
    fileUrl: fileUrl(s.fileUrl ?? ""),
    fileName: s.fileName ?? "",
    signaturePage: s.signaturePage ?? 0,
    signatureAnchor: (s.signatureAnchor as SignatureAnchor) ?? "bottom-right",
    requireSignerName: s.requireSignerName ?? true,
    isActive: s.isActive ?? true,
    createdByName: s.createdByName,
    createdAt: s.createdAt,
  };
}
