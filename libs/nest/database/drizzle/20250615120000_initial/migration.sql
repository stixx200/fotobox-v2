CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `share_tokens_expires_at_idx` ON `share_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_created_at_idx` ON `photos` (`created_at`);
