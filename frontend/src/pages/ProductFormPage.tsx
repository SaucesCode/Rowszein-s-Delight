import { useEffect, useId, useState, type ChangeEvent } from "react";
import { useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ImagePlus, Star, Trash2 } from "lucide-react";
import { useCategories, useCreateProduct, useDeleteProduct, useProduct, useUpdateProduct } from "@/hooks/useProducts";
import { usePartners } from "@/hooks/usePartners";
import { apiFieldErrors } from "@/lib/csrfTransport";
import { validRecordId } from "@/lib/managementQueryKeys";
import { flavorOf, flavorTint } from "@/lib/flavor";
import type { Category, Product } from "@/types/product.types";
import type { Partner } from "@/types/partner.types";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordLoadError from "@/components/RecordLoadError";
import DonutArt from "@/components/DonutArt";
import Switch from "@/components/ui/Switch";
import Row from "@/components/ui/SettingsRow";
import { formatPeso } from "@/pages/dashboard/report-format";
import { joinPartnerPrice, splitPartnerPrice } from "./products/partnerPricing";
import "./products/products.css";

const productSchema = z
  .object({
    name: z.string().trim().min(1, "Give the item a name"),
    description: z.string().optional(),
    price: z.number({ error: "Enter a price, like 45" }),
    category_id: z.number().min(1, "Choose a category"),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    box_extra: z.number({ error: "Enter an amount, like 10, or 0" }).min(0, "The extra can't be below ₱0"),
    /** 0 means made by Rowszein's Delight. */
    partner_id: z.number(),
    their_price: z.number({ error: "Enter their price, like 50" }),
    patong: z.number({ error: "Enter your patong, or 0" }),
  })
  .superRefine((data, ctx) => {
    if (!data.partner_id) {
      if (!(data.price > 0)) ctx.addIssue({ code: "custom", path: ["price"], message: "The price must be more than ₱0" });
      return;
    }
    if (!(data.their_price > 0)) ctx.addIssue({ code: "custom", path: ["their_price"], message: "Enter their price, above ₱0" });
    if (!(data.patong >= 0)) ctx.addIssue({ code: "custom", path: ["patong"], message: "Your patong can't be less than ₱0" });
  });

type ProductForm = z.infer<typeof productSchema>;

interface DuplicateState {
  name?: string;
  description?: string;
  price?: number;
  category_id?: number;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_MB = 5;

function DonutForm({ product, duplicate, initialPartner = 0 }: {
  product?: Product;
  duplicate?: DuplicateState;
  initialPartner?: number;
}) {
  const navigate = useNavigate();
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const isEdit = !!product;

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const categories: Category[] = (categoriesData?.data ?? []).filter((category: Category) => category.is_active);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(product?.id ?? 0);
  const deleteProduct = useDeleteProduct();
  const partnersQuery = usePartners();
  const savedSplit = product?.partner ? splitPartnerPrice(product.price, product.partner_payout ?? 0) : { their: 0, patong: 0 };

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.image_url ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description,
          price: Number(product.price),
          category_id: product.category.id,
          is_available: product.is_available,
          is_featured: product.is_featured,
          box_extra: Number(product.box_extra ?? 0),
          partner_id: product.partner?.id ?? 0,
          their_price: savedSplit.their,
          patong: savedSplit.patong,
        }
      : {
          name: duplicate?.name ?? "",
          description: duplicate?.description ?? "",
          price: duplicate?.price ?? 45,
          category_id: duplicate?.category_id ?? 0,
          is_available: true,
          is_featured: false,
          box_extra: 0,
          partner_id: initialPartner,
          their_price: 0,
          patong: 0,
        },
  });

  const [name, description, ownPrice, categoryId, isAvailable, isFeatured, partnerId, theirPrice, patong] = useWatch({
    control,
    name: ["name", "description", "price", "category_id", "is_available", "is_featured", "partner_id", "their_price", "patong"],
  });
  const isPartnerItem = partnerId > 0;
  const price = isPartnerItem ? joinPartnerPrice(theirPrice || 0, patong || 0) : ownPrice;
  // Active partners, plus this item's own partner even if it has been switched off.
  const partnerChoices = ((partnersQuery.data ?? []) as Partner[]).filter(
    partner => partner.is_active || partner.id === product?.partner?.id,
  );
  const partnerName = partnerChoices.find(partner => partner.id === partnerId)?.name;
  const categoryName = categories.find(category => category.id === categoryId)?.name;
  const flavor = flavorOf(name, categoryName);

  useEffect(() => {
    if (!categoryId && categories[0]) setValue("category_id", categories[0].id);
  }, [categories, categoryId, setValue]);

  useEffect(() => {
    if (!photoFile || !photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoFile, photoPreview]);

  const isSaving = createProduct.isPending || updateProduct.isPending;
  const isDone = createProduct.isSuccess || updateProduct.isSuccess || deleteProduct.isPending || deleteProduct.isSuccess;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (isDirty || !!photoFile) && !isSaving && !isDone && currentLocation.pathname !== nextLocation.pathname,
  );

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setPhotoError("Choose a JPG, PNG or WEBP photo.");
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return setPhotoError(`Choose a photo under ${PHOTO_MAX_MB} MB.`);
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = ({ their_price, patong: ownerPatong, partner_id, ...data }: ProductForm) => {
    const partnered = partner_id > 0;
    const payload = {
      ...data,
      name: data.name.trim(),
      image: photoFile,
      price: partnered ? joinPartnerPrice(their_price, ownerPatong) : data.price,
      box_extra: partnered ? 0 : data.box_extra,
      partner_id: partnered ? partner_id : null,
      partner_payout: partnered ? their_price : 0,
    };
    const showFieldErrors = (error: unknown) => {
      const fields = apiFieldErrors(error) ?? {};
      if (fields.name) setError("name", { message: fields.name });
      if (fields.price) setError(partnered ? "patong" : "price", { message: fields.price });
      if (fields.partner_id) setError("partner_id", { message: fields.partner_id });
      if (fields.partner_payout) {
        setError(fields.partner_payout.includes("patong") ? "patong" : "their_price", { message: fields.partner_payout });
      }
    };
    if (product) updateProduct.mutate(payload, { onError: showFieldErrors });
    else createProduct.mutate(payload, { onError: showFieldErrors });
  };

  const makeCopy = () =>
    product &&
    navigate("/products/new", {
      state: {
        duplicate: {
          name: `${product.name} (copy)`,
          description: product.description,
          price: Number(product.price),
          category_id: product.category.id,
        },
      },
    });

  const priceText = Number.isFinite(price) && price > 0 ? formatPeso(price) : "₱—";

  return (
    <>
      <form className="settings-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className="page-head">
          <div>
            <h1 className="type-page">{product ? product.name : isPartnerItem ? "Add a partner item" : "Add a donut"}</h1>
            <p className="page-lede">
              {product ? "Changes show in the online shop as soon as you save." : "Fill in the basics. You can change any of it later."}
            </p>
          </div>
        </header>

        {duplicate && (
          <p className="settings-notice" role="status">
            This is a copy of another donut. Give it its own name and photo, then save.
          </p>
        )}

        <div className="donut-preview" data-resting={!isAvailable || undefined} aria-hidden="true">
          <span className="donut-preview-art" style={{ background: flavorTint(flavor) }}>
            {photoPreview ? <img src={photoPreview} alt="" /> : <DonutArt flavor={flavor} size={88} />}
          </span>
          <div className="donut-preview-body">
            <p className="donut-preview-label">How it reads on the menu</p>
            <p className="menu-line-top">
              <span className="menu-line-name">
                {name.trim() || "Your new donut"}
                {isFeatured && <Star className="menu-line-star" size={16} strokeWidth={2} />}
              </span>
              <span className="menu-line-leader" />
              <span className="menu-line-price num">{priceText}</span>
            </p>
            {description && <p className="menu-line-desc">{description}</p>}
            <p className="donut-preview-status">{isAvailable ? "In the shop" : "Resting, hidden from the shop"}</p>
          </div>
        </div>

        <section className="settings-group" aria-labelledby={field("about")}>
          <h2 id={field("about")} className="settings-group-title">{isPartnerItem ? "About the item" : "About the donut"}</h2>
          <div className="settings-card">
            <Row label="Name" htmlFor={field("name")} error={errors.name?.message}>
              <input
                id={field("name")}
                className="field-input"
                placeholder="For example, Strawberry Frosted"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${field("name")}-msg` : undefined}
                {...register("name")}
              />
            </Row>
            <Row label="Category" error={errors.category_id?.message}>
              <fieldset className="settings-chips" aria-label="Category">
                {categoriesLoading ? (
                  <span className="skeleton block h-11 w-64" />
                ) : categories.length === 0 ? (
                  <p className="field-hint">No categories yet. Ask whoever set up the shop to add one first.</p>
                ) : (
                  categories.map(category => (
                    <label key={category.id} className="chip">
                      <input
                        type="radio"
                        name={field("category")}
                        className="sr-only"
                        checked={categoryId === category.id}
                        onChange={() => setValue("category_id", category.id, { shouldValidate: true, shouldDirty: true })}
                      />
                      {category.name}
                    </label>
                  ))
                )}
              </fieldset>
            </Row>
            <Row label="Description" htmlFor={field("description")} hint="Optional. Customers see this in the online shop.">
              <textarea
                id={field("description")}
                className="field-input"
                rows={3}
                placeholder="What makes it special? The glaze, the filling, the toppings."
                aria-describedby={`${field("description")}-msg`}
                {...register("description")}
              />
            </Row>
            <Row
              label="Photo"
              error={photoError ?? undefined}
              hint="Optional. Without one, the shop shows the donut drawing above."
            >
              <label className="btn-secondary settings-photo-button">
                <ImagePlus size={18} aria-hidden="true" />
                {photoPreview ? "Change photo" : "Add a photo"}
                <input type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" onChange={handlePhoto} />
              </label>
            </Row>
          </div>
        </section>

        <section className="settings-group" aria-labelledby={field("selling")}>
          <h2 id={field("selling")} className="settings-group-title">Selling</h2>
          <div className="settings-card">
            {(partnerChoices.length > 0 || isPartnerItem) && (
              <Row
                label="Made by"
                htmlFor={field("partner")}
                error={errors.partner_id?.message}
                hint={isPartnerItem ? "A collab partner's item: sold one at a time, never in boxes." : undefined}
              >
                <select
                  id={field("partner")}
                  className="field-input settings-select"
                  value={partnerId}
                  aria-invalid={!!errors.partner_id}
                  aria-describedby={`${field("partner")}-msg`}
                  onChange={event => setValue("partner_id", Number(event.target.value), { shouldDirty: true, shouldValidate: true })}
                >
                  <option value={0}>Rowszein's Delight</option>
                  {partnerChoices.map(partner => (
                    <option key={partner.id} value={partner.id}>{partner.name}</option>
                  ))}
                </select>
              </Row>
            )}
            {isPartnerItem ? (
              <>
                <Row
                  label="Their price"
                  htmlFor={field("their-price")}
                  error={errors.their_price?.message}
                  hint={`What you pay ${partnerName ?? "the partner"} for each one sold.`}
                >
                  <div className="settings-unit-input is-prefix settings-price">
                    <span aria-hidden="true">₱</span>
                    <input
                      id={field("their-price")}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      className="field-input num"
                      aria-invalid={!!errors.their_price}
                      aria-describedby={`${field("their-price")}-msg`}
                      {...register("their_price", { valueAsNumber: true })}
                    />
                  </div>
                </Row>
                <Row
                  label="Your patong"
                  htmlFor={field("patong")}
                  error={errors.patong?.message}
                  hint={`Your charge on top. Sells for ${priceText} in the shop.`}
                >
                  <div className="settings-unit-input is-prefix settings-price">
                    <span aria-hidden="true">₱</span>
                    <input
                      id={field("patong")}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="field-input num"
                      aria-invalid={!!errors.patong}
                      aria-describedby={`${field("patong")}-msg`}
                      {...register("patong", { valueAsNumber: true })}
                    />
                  </div>
                </Row>
              </>
            ) : (
              <Row label="Price per piece" htmlFor={field("price")} error={errors.price?.message}>
                <div className="settings-unit-input is-prefix settings-price">
                  <span aria-hidden="true">₱</span>
                  <input
                    id={field("price")}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    className="field-input num"
                    aria-invalid={!!errors.price}
                    aria-describedby={errors.price ? `${field("price")}-msg` : undefined}
                    {...register("price", { valueAsNumber: true })}
                  />
                </div>
              </Row>
            )}
            {!isPartnerItem && (
            <Row
              label="Extra when in a box"
              htmlFor={field("box-extra")}
              error={errors.box_extra?.message}
              hint="Added to a box's price for each one inside. Leave at ₱0 for regular flavours."
            >
              <div className="settings-unit-input is-prefix settings-price">
                <span aria-hidden="true">₱</span>
                <input
                  id={field("box-extra")}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="field-input num"
                  aria-invalid={!!errors.box_extra}
                  aria-describedby={`${field("box-extra")}-msg`}
                  {...register("box_extra", { valueAsNumber: true })}
                />
              </div>
            </Row>
            )}
            <Row label="In the shop">
              <div className="settings-switch-row">
                <Switch
                  checked={isAvailable}
                  onChange={next => setValue("is_available", next, { shouldDirty: true })}
                  describedBy={field("shop-hint")}
                >
                  Show in the online shop
                </Switch>
                <p id={field("shop-hint")} className="field-hint">
                  {isAvailable ? "Customers can see and order it." : "Resting: hidden from customers, still sold at the counter."}
                </p>
              </div>
              <div className="settings-switch-row">
                <Switch
                  checked={isFeatured}
                  onChange={next => setValue("is_featured", next, { shouldDirty: true })}
                  describedBy={field("featured-hint")}
                >
                  Mark as a best seller
                </Switch>
                <p id={field("featured-hint")} className="field-hint">Adds a star and a “Best seller” badge in the shop.</p>
              </div>
            </Row>
          </div>
        </section>

        {product && (
          <section className="settings-group" aria-label="More actions">
            <div className="settings-card settings-actions-card">
              <button type="button" className="settings-action" onClick={makeCopy}>
                <Copy size={18} aria-hidden="true" />
                Make a copy
              </button>
              <button type="button" className="settings-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={18} aria-hidden="true" />
                Delete donut
              </button>
            </div>
          </section>
        )}

        <footer className="settings-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate("/products")}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add to collection"}
          </button>
        </footer>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${product?.name ?? "this donut"}?`}
        description="It will be removed from your collection and the online shop, and this can't be undone. To stop selling it for a while, switch off “Show in the online shop” instead."
        confirmLabel="Delete donut"
        cancelLabel="Keep it"
        destructive
        loading={deleteProduct.isPending}
        onConfirm={() => product && deleteProduct.mutate(product.id, { onSuccess: () => navigate("/products") })}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="Your changes to this donut haven't been saved yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="settings-form" aria-busy="true">
      <span className="skeleton block h-10 w-72" />
      <span className="skeleton mt-8 block h-36 w-full" aria-hidden="true" />
      <span className="skeleton mt-8 block h-64 w-full" aria-hidden="true" />
      <span className="sr-only" role="status">Loading the donut</span>
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = id !== undefined;
  const recordId = Number(id);
  const productQuery = useProduct(isEdit ? recordId : 0);
  const duplicate = isEdit ? undefined : (location.state as { duplicate?: DuplicateState } | null)?.duplicate;

  if (!isEdit) {
    const partnerParam = Number(new URLSearchParams(location.search).get("partner"));
    return <DonutForm key={location.key} duplicate={duplicate} initialPartner={validRecordId(partnerParam) ? partnerParam : 0} />;
  }

  const back = () => navigate("/products");
  if (!validRecordId(recordId)) {
    return <RecordLoadError name="donut" invalidId error={undefined} retry={() => {}} back={back} />;
  }
  if (productQuery.isPending) return <FormSkeleton />;
  if (productQuery.isError || !productQuery.data) {
    return (
      <RecordLoadError name="donut" invalidId={false} error={productQuery.error} retry={() => void productQuery.refetch()} back={back} />
    );
  }
  return <DonutForm key={productQuery.data.id} product={productQuery.data} />;
}
