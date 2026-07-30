ALTER TABLE "SiteUser"
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "SiteUser"
ADD CONSTRAINT "SiteUser_locale_check"
CHECK ("locale" IN ('en', 'fr'));
