import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit, FileSignature, FileText, Loader2, Plus, Trash2, Upload,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";
import {
  useDocumentTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from "@/hooks/api/use-documents";
import { DocTemplate } from "@/lib/document-mapper";

interface FormState {
  id?: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  file: File | null;
}

const EMPTY: FormState = {
  name: "", description: "", category: "general", isActive: true, file: null,
};

/**
 * Reusable Document Templates manager (list + create/edit/delete). Rendered both
 * as the Settings → Documents tab and on the standalone /settings/document-templates
 * page. Self-contained: its own header row (title + New template) + dialogs.
 */
export function DocumentTemplatesManager() {
  const canEdit = useCan("Settings", "edit");
  const canDelete = useCan("Settings", "delete");

  const { data: templates = [], isLoading } = useDocumentTemplates(true);
  const createTpl = useCreateTemplate();
  const updateTpl = useUpdateTemplate();
  const deleteTpl = useDeleteTemplate();

  const fileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<DocTemplate | null>(null);

  const isEdit = !!form.id;

  const openCreate = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t: DocTemplate) => {
    setForm({
      id: t.id, name: t.name, description: t.description, category: t.category,
      isActive: t.isActive, file: null,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    try {
      if (isEdit) {
        await updateTpl.mutateAsync({
          id: form.id!,
          input: {
            name: form.name, description: form.description, category: form.category,
            isActive: form.isActive,
          },
        });
        toast({ title: "Template updated" });
      } else {
        if (!form.file) { toast({ title: "A PDF or image file is required", variant: "destructive" }); return; }
        await createTpl.mutateAsync({
          name: form.name, file: form.file, description: form.description, category: form.category,
          isActive: form.isActive,
        });
        toast({ title: "Template created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const toggleActive = async (t: DocTemplate) => {
    try {
      await updateTpl.mutateAsync({ id: t.id, input: { isActive: !t.isActive } });
      toast({ title: t.isActive ? "Template deactivated" : "Template activated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteTpl.mutateAsync(deleteTarget.id); toast({ title: "Template deleted" }); }
    catch (err) { toast({ title: "Delete failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }); }
    finally { setDeleteTarget(null); }
  };

  const saving = createTpl.isPending || updateTpl.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Document Templates
          </h3>
          <p className="text-sm text-muted-foreground">
            Reusable signable documents. Assign a template to a buyer from their profile to have them sign it.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New template
          </button>
        )}
      </div>

      <div className="stat-card">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No templates yet.</p>
        ) : (
          <ul className="divide-y">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium">{t.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {t.sourceType.toUpperCase()}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-2" title={t.isActive ? "Active — click to deactivate" : "Inactive — click to activate"}>
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={() => toggleActive(t)}
                      disabled={updateTpl.isPending}
                      aria-label={t.isActive ? "Deactivate template" : "Activate template"}
                    />
                    <span className={`w-14 text-xs ${t.isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {t.fileUrl && (
                    <a href={t.fileUrl} target="_blank" rel="noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Preview">
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                  {canEdit && (
                    <button onClick={() => openEdit(t)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setDeleteTarget(t)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update the template details. To change the file, create a new template." : "Upload a PDF or image the buyer will sign."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>

            {!isEdit && (
              <div>
                <label className="text-sm font-medium">Template file (PDF, PNG, JPEG)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                  className="mt-1 w-full text-sm"
                />
                {form.file && <p className="mt-1 text-xs text-muted-foreground">{form.file.name}</p>}
              </div>
            )}

          </div>

          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Edit className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {isEdit ? "Save" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be removed. Documents already created from it keep working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Standalone page (deep-link /settings/document-templates) — the manager under a back link. */
export default function DocumentTemplates() {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate("/settings")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Settings
      </button>
      <DocumentTemplatesManager />
    </div>
  );
}
