"""Pydantic request/response models."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    user_id: str
    credits: int
    plan: str
    is_anonymous: bool
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    brand_name: str | None = None  # B2B studio branding


class BrandUpdate(BaseModel):
    brand_name: str = Field(default="", max_length=60)


class SessionOut(UserOut):
    token: str


class HealthOut(BaseModel):
    status: str
    version: str


class ReadyOut(BaseModel):
    """Readiness probe: liveness + dependency reachability (DB, Redis)."""

    status: str  # "ready" | "degraded"
    version: str
    checks: dict[str, str]  # component -> "ok" | "error"


class BillingConfigOut(BaseModel):
    """Whether Stripe billing is live + the publishable key for the client."""

    enabled: bool
    publishable_key: str | None = None


class CheckoutCreate(BaseModel):
    # Explicit consent to immediate performance + waiver of the 14-day withdrawal
    # right for digital services (§ 356 Abs. 4/5 BGB). Required to start checkout.
    waive_withdrawal: bool = False


class CheckoutOut(BaseModel):
    url: str  # Stripe-hosted Checkout or Customer Portal URL to redirect to


class QuotaOut(BaseModel):
    """Live generation quota for the current user (drives the paywall/meter)."""

    plan: str
    period: str  # "lifetime" | "month"
    limit: int | None  # None == unlimited
    used: int
    remaining: int | None  # None == unlimited
    reset_at: datetime | None  # start of next month; null for lifetime/unlimited
    promo: bool = False  # launch promo active → UI shows "preview unlimited" pill


class StylePublic(BaseModel):
    slug: str
    name: str
    category: str
    description: str
    tags: list[str]
    default_modifiers: dict


class DesignCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    styles: list[str] = Field(default_factory=list)
    color: bool = True
    line_weight: str = "medium"
    complexity: str = "medium"


class DesignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    prompt: str
    styles: list[str]
    clean_png_url: str | None
    thumb_url: str | None
    width: int | None
    height: int | None
    parent_design_id: str | None
    error: str | None
    created_at: datetime


class FeedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    thumb_url: str | None
    clean_png_url: str | None


class PromptEnhanceIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    styles: list[str] = Field(default_factory=list)


class PromptEnhanceOut(BaseModel):
    enhanced: str


class BodyPhotoOut(BaseModel):
    id: str
    url: str
    expires_at: datetime


class PreviewCreate(BaseModel):
    design_id: str
    body_photo_id: str
    x_pct: float = Field(ge=0, le=1)
    y_pct: float = Field(ge=0, le=1)
    scale: float = Field(0.30, ge=0.05, le=1.0)  # free size: fraction of body width
    rotation: float = Field(0.0, ge=-180, le=180)  # free rotation, degrees


class PreviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    design_id: str
    body_photo_id: str
    x_pct: float
    y_pct: float
    scale: float
    rotation: float
    output_url: str | None
    error: str | None
    expires_at: datetime
    created_at: datetime


class CaptureCreate(BaseModel):
    design_id: str | None = None  # design the phone overlays on its live camera


class CaptureOut(BaseModel):
    token: str


class CaptureStatusOut(BaseModel):
    status: str
    body_photo_id: str | None
    url: str | None
    # Placement the phone chose live (present when it used the live-camera flow).
    x_pct: float | None = None
    y_pct: float | None = None
    scale: float | None = None
    rotation: float | None = None


class CaptureInfoOut(BaseModel):
    """Public (token-authorized) info for the phone: what design to overlay."""

    status: str
    design_thumb_url: str | None = None


class MockupCreate(BaseModel):
    preview_id: str


class MockupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    design_id: str | None
    output_url: str
    created_at: datetime


class ExportCreate(BaseModel):
    design_id: str
    preview_id: str | None = None


class ExportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    hires_url: str | None
    mockup_url: str | None
    stencil_url: str | None = None
    watermarked: bool
    created_at: datetime
