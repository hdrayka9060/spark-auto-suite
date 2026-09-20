import { useRef, useState } from "react";
import {
  Ban, Download, Eye, FileSignature, FileText, Loader2, PenLine, Plus, Trash2, Upload,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { SignatureDialog, type Placement } from "@/components/SignatureDialog";
import {
  useBuyerDocuments, useUploadBuyerDocument, useCreateSignableFromTemplate,
  useUploadSignableDocument, useSignDocument, useVoidDocument, useDeleteDocument, useDocumentTemplates,
} from "@/hooks/api/use-documents";
import { BuyerDoc, DOC_TYPES, docTypeLabel } from "@/lib/document-mapper";

interface Props {
  buyerLeadId: string;
  buyerName?: string;
  leadId?: string;
  vehicleId?: string;
  canEdit: boolean;
  canDelete: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  signed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  void: "bg-destructive/15 text-destructive line-through",
};

export function BuyerDocumentsCard({
  buyerLeadId, buyerName, leadId, vehicleId, canEdit, canDelete,
}: Props) {
  const { data: docs = [], isLoading } = useBuyerDocuments(buyerLeadId);
  const { data: templates = [] } = useDocumentTemplates(false);
  const uploadDoc = useUploadBuyerDocument();
  const fromTemplate = useCreateSignableFromTemplate();
  const uploadSignable = useUploadSignableDocument();
  const signDoc = useSignDocument();
  const voidDoc = useVoidDocument();
  const deleteDoc = useDeleteDocument();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("drivers_license");

  const [tplOpen, setTplOpen] = useState(false);
  const [tplId, setTplId] = useState<string>("");
  // "Add for signature" dialog: template vs a newly uploaded document.
  const [sigMode, setSigMode] = useState<"template" | "upload">("template");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const [signTarget, setSignTarget] = useState<BuyerDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuyerDoc | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(f);
    if (f && !uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ""));
    setUploadOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitUpload = async () => {
    if (!uploadFile) return;
    try {
      await uploadDoc.mutateAsync({
        buyerLeadId, file: uploadFile, title: uploadTitle || uploadFile.name,
        docType: uploadType, leadId, vehicleId,
      });
      toast({ title: "Document uploaded" });
      setUploadOpen(false); setUploadFile(null); setUploadTitle(""); setUploadType("drivers_license");
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const openSigDialog = () => {
    setSigMode(templates.length ? "template" : "upload");
    setTplId(""); setNewFile(null); setNewTitle(""); setSaveAsTemplate(false); setTemplateName("");
    setTplOpen(true);
  };

  const submitTemplate = async () => {
    if (!tplId) { toast({ title: "Pick a template", variant: "destructive" }); return; }
    try {
      await fromTemplate.mutateAsync({ buyerLeadId, templateId: tplId, leadId, vehicleId });
      toast({ title: "Ready to sign", description: "The document was added for signature." });
      setTplOpen(false); setTplId("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const submitUploadSignable = async () => {
    if (!newFile) { toast({ title: "Choose a file", variant: "destructive" }); return; }
    try {
      await uploadSignable.mutateAsync({
        buyerLeadId, file: newFile, title: newTitle || newFile.name, leadId, vehicleId,
        saveAsTemplate, templateName: saveAsTemplate ? (templateName || newTitle || newFile.name) : undefined,
      });
      toast({
        title: "Ready to sign",
        description: saveAsTemplate ? "Added for signature and saved as a template." : "Added for signature.",
      });
      setTplOpen(false); setNewFile(null); setNewTitle(""); setSaveAsTemplate(false); setTemplateName("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const sigBusy = fromTemplate.isPending || uploadSignable.isPending;

  const submitSignature = async (placements: Placement[], signerName: string) => {
    if (!signTarget) return;
    await signDoc.mutateAsync({
      id: signTarget.id,
      placements: placements.map((p) => ({
        page: p.page, x: p.x, y: p.y, width: p.width, signatureImage: p.signatureImage,
      })),
      signerName,
    });
    toast({ title: "Document signed" });
  };

  const handleVoid = async (doc: BuyerDoc) => {
    try { await voidDoc.mutateAsync(doc.id); toast({ title: "Document voided" }); }
    catch (err) { toast({ title: "Failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDoc.mutateAsync(deleteTarget.id); toast({ title: "Document deleted" }); }
    catch (err) { toast({ title: "Delete failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }); }
    finally { setDeleteTarget(null); }
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Documents
        </h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <button
              onClick={openSigDialog}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <FileSignature className="h-3.5 w-3.5" /> Add for signature
            </button>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={onPickFile}
        className="hidden"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No documents yet.</p>
      ) : (
        <ul className="divide-y">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{doc.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[doc.status] ?? ""}`}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doc.kind === "signable" ? doc.templateName || "Signable" : docTypeLabel(doc.docType)}
                  {doc.signature?.signerName ? ` · signed by ${doc.signature.signerName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {doc.viewUrl && (
                  <a
                    href={doc.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={doc.signedFileUrl ? "View signed document" : "View document"}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {doc.signedFileUrl ? <Download className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </a>
                )}
                {canEdit && doc.kind === "signable" && doc.status === "pending" && (
                  <button
                    onClick={() => setSignTarget(doc)}
                    title="Sign"
                    className="rounded p-1.5 text-primary hover:bg-primary/10"
                  >
                    <PenLine className="h-4 w-4" />
                  </button>
                )}
                {canEdit && doc.kind === "signable" && doc.status === "pending" && (
                  <button
                    onClick={() => handleVoid(doc)}
                    title="Void"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    title="Delete"
                    className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => !uploadDoc.isPending && setUploadOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>{uploadFile?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setUploadOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <button
              onClick={submitUpload}
              disabled={uploadDoc.isPending || !uploadFile}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {uploadDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add for signature — from a template OR a newly uploaded document */}
      <Dialog open={tplOpen} onOpenChange={(o) => !sigBusy && setTplOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document for signature</DialogTitle>
            <DialogDescription>Prepare a document for {buyerName || "this buyer"} to sign.</DialogDescription>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setSigMode("template")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${sigMode === "template" ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
            >
              Use a template
            </button>
            <button
              onClick={() => setSigMode("upload")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${sigMode === "upload" ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
            >
              Upload new document
            </button>
          </div>

          {sigMode === "template" ? (
            templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No templates yet. Upload a new document instead, or add templates under Settings → Documents.
              </p>
            ) : (
              <Select value={tplId} onValueChange={setTplId}>
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Document file (PDF, PNG, JPEG)</label>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setNewFile(f);
                    if (f && !newTitle) setNewTitle(f.name.replace(/\.[^.]+$/, ""));
                  }}
                  className="mt-1 w-full text-sm"
                />
                {newFile && <p className="mt-1 text-xs text-muted-foreground">{newFile.name}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Purchase Agreement"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                Also save as a reusable template
              </label>
              {saveAsTemplate && (
                <div>
                  <label className="text-sm font-medium">Template name</label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={newTitle || "Template name"}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
              {!saveAsTemplate && (
                <p className="text-xs text-muted-foreground">This document will be specific to {buyerName || "this buyer"} only.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <button onClick={() => setTplOpen(false)} disabled={sigBusy} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
            {sigMode === "template" ? (
              <button
                onClick={submitTemplate}
                disabled={sigBusy || !tplId}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sigBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </button>
            ) : (
              <button
                onClick={submitUploadSignable}
                disabled={sigBusy || !newFile}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sigBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature capture */}
      <SignatureDialog
        open={!!signTarget}
        onOpenChange={(o) => !o && setSignTarget(null)}
        doc={signTarget}
        defaultSignerName={buyerName}
        onSubmit={submitSignature}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
