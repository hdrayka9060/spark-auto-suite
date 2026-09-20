import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BuyerDoc,
  DocTemplate,
  ServerBuyerDocument,
  ServerDocTemplate,
  toBuyerDoc,
  toDocTemplate,
} from "@/lib/document-mapper";

const DOCS_KEY = ["buyer-documents"] as const;
const TEMPLATES_KEY = ["document-templates"] as const;

/* ----------------------------- Buyer documents ---------------------------- */

export function useBuyerDocuments(buyerLeadId: string | undefined) {
  return useQuery({
    queryKey: [...DOCS_KEY, "by-buyer", buyerLeadId],
    queryFn: async (): Promise<BuyerDoc[]> => {
      const rows = await api<ServerBuyerDocument[]>("/documents", { query: { buyerLeadId } });
      return rows.map(toBuyerDoc);
    },
    enabled: Boolean(buyerLeadId),
  });
}

function invalidateDocs(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: DOCS_KEY });
}

export interface UploadDocInput {
  buyerLeadId: string;
  file: File;
  title?: string;
  docType?: string;
  leadId?: string;
  vehicleId?: string;
  notes?: string;
}

export function useUploadBuyerDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadDocInput): Promise<BuyerDoc> => {
      const fd = new FormData();
      fd.append("buyerLeadId", input.buyerLeadId);
      fd.append("file", input.file);
      if (input.title) fd.append("title", input.title);
      if (input.docType) fd.append("docType", input.docType);
      if (input.leadId) fd.append("leadId", input.leadId);
      if (input.vehicleId) fd.append("vehicleId", input.vehicleId);
      if (input.notes) fd.append("notes", input.notes);
      const created = await api<ServerBuyerDocument>("/documents/upload", {
        method: "POST",
        body: fd,
        rawBody: true,
      });
      return toBuyerDoc(created);
    },
    onSuccess: () => invalidateDocs(qc),
  });
}

export interface FromTemplateInput {
  buyerLeadId: string;
  templateId: string;
  title?: string;
  leadId?: string;
  vehicleId?: string;
}

export function useCreateSignableFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FromTemplateInput): Promise<BuyerDoc> => {
      const created = await api<ServerBuyerDocument>("/documents/from-template", {
        method: "POST",
        body: input,
      });
      return toBuyerDoc(created);
    },
    onSuccess: () => invalidateDocs(qc),
  });
}

export interface SignPlacement {
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  signatureImage: string;
}

export interface UploadSignableInput {
  buyerLeadId: string;
  file: File;
  title?: string;
  leadId?: string;
  vehicleId?: string;
  saveAsTemplate?: boolean;
  templateName?: string;
  category?: string;
}

/** Upload a NEW document to sign — one-off, or saved as a reusable template. */
export function useUploadSignableDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadSignableInput): Promise<BuyerDoc> => {
      const fd = new FormData();
      fd.append("buyerLeadId", input.buyerLeadId);
      fd.append("file", input.file);
      if (input.title) fd.append("title", input.title);
      if (input.leadId) fd.append("leadId", input.leadId);
      if (input.vehicleId) fd.append("vehicleId", input.vehicleId);
      if (input.saveAsTemplate) fd.append("saveAsTemplate", "true");
      if (input.templateName) fd.append("templateName", input.templateName);
      if (input.category) fd.append("category", input.category);
      const created = await api<ServerBuyerDocument>("/documents/upload-signable", {
        method: "POST",
        body: fd,
        rawBody: true,
      });
      return toBuyerDoc(created);
    },
    onSuccess: () => {
      invalidateDocs(qc);
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

export function useSignDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      placements,
      signerName,
    }: {
      id: string;
      placements: SignPlacement[];
      signerName?: string;
    }): Promise<BuyerDoc> => {
      const signed = await api<ServerBuyerDocument>(`/documents/${id}/sign`, {
        method: "POST",
        body: { placements, signerName },
      });
      return toBuyerDoc(signed);
    },
    onSuccess: () => invalidateDocs(qc),
  });
}

export function useVoidDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<BuyerDoc> => {
      const voided = await api<ServerBuyerDocument>(`/documents/${id}/void`, { method: "POST" });
      return toBuyerDoc(voided);
    },
    onSuccess: () => invalidateDocs(qc),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateDocs(qc),
  });
}

/* ---------------------------- Document templates --------------------------- */

export function useDocumentTemplates(includeInactive = false) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, { includeInactive }],
    queryFn: async (): Promise<DocTemplate[]> => {
      const rows = await api<ServerDocTemplate[]>("/documents/templates", {
        query: { includeInactive: includeInactive ? "true" : undefined },
      });
      return rows.map(toDocTemplate);
    },
  });
}

export interface CreateTemplateInput {
  name: string;
  file: File;
  description?: string;
  category?: string;
  signaturePage?: number;
  signatureAnchor?: string;
  requireSignerName?: boolean;
  isActive?: boolean;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput): Promise<DocTemplate> => {
      const fd = new FormData();
      fd.append("name", input.name);
      fd.append("file", input.file);
      if (input.description) fd.append("description", input.description);
      if (input.category) fd.append("category", input.category);
      if (input.signaturePage !== undefined) fd.append("signaturePage", String(input.signaturePage));
      if (input.signatureAnchor) fd.append("signatureAnchor", input.signatureAnchor);
      if (input.requireSignerName !== undefined)
        fd.append("requireSignerName", String(input.requireSignerName));
      if (input.isActive !== undefined) fd.append("isActive", String(input.isActive));
      const created = await api<ServerDocTemplate>("/documents/templates", {
        method: "POST",
        body: fd,
        rawBody: true,
      });
      return toDocTemplate(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  signaturePage?: number;
  signatureAnchor?: string;
  requireSignerName?: boolean;
  isActive?: boolean;
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTemplateInput }): Promise<DocTemplate> => {
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) body[k] = String(v);
      }
      const updated = await api<ServerDocTemplate>(`/documents/templates/${id}`, {
        method: "PATCH",
        body,
      });
      return toDocTemplate(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/documents/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}
