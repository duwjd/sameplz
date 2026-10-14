
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "abuse_signals": {
                  Row: {
                    "created_at": string,"detail": NonNullable<Json>,"id": number,"key_hash": string | null,"kind": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"key_hash"?: string | null,"kind": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"key_hash"?: string | null,"kind"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "abuse_signals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"account_devices": {
                  Row: {
                    "device_hash": string,"first_seen": string,"ip_hash": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_hash": string,"first_seen"?: string,"ip_hash"?: string | null,"user_id": string
                  }
                  Update: {
                    "device_hash"?: string,"first_seen"?: string,"ip_hash"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_actions": {
                  Row: {
                    "action": string,"actor_id": string,"created_at": string,"detail": NonNullable<Json>,"id": number,"reason": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"reason": string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"reason"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"auto_checks": {
                  Row: {
                    "checker": string,"created_at": string,"findings": NonNullable<Json>,"id": number,"layer": number,"result": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checker"?: string,"created_at"?: string,"findings"?: NonNullable<Json>,"id"?: never,"layer": number,"result": string,"version_id": string
                  }
                  Update: {
                    "checker"?: string,"created_at"?: string,"findings"?: NonNullable<Json>,"id"?: never,"layer"?: number,"result"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auto_checks_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "active": boolean,"alt_text": string | null,"created_at": string,"cta_href": string | null,"cta_label": string | null,"eyebrow": string,"id": string,"media_id": string | null,"name": string,"sort": number,"subtitle": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"alt_text"?: string | null,"created_at"?: string,"cta_href"?: string | null,"cta_label"?: string | null,"eyebrow"?: string,"id"?: string,"media_id"?: string | null,"name": string,"sort"?: number,"subtitle"?: string,"title": string
                  }
                  Update: {
                    "active"?: boolean,"alt_text"?: string | null,"created_at"?: string,"cta_href"?: string | null,"cta_label"?: string | null,"eyebrow"?: string,"id"?: string,"media_id"?: string | null,"name"?: string,"sort"?: number,"subtitle"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "banners_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_items": {
                  Row: {
                    "collection_id": string,"recipe_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_id": string,"recipe_id": string,"sort"?: number
                  }
                  Update: {
                    "collection_id"?: string,"recipe_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "collection_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"collections": {
                  Row: {
                    "created_at": string,"id": string,"intro": string,"reason": string,"slug": string,"sort": number,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"intro"?: string,"reason"?: string,"slug": string,"sort"?: number,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"intro"?: string,"reason"?: string,"slug"?: string,"sort"?: number,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consent_events": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"user_id": string,"version": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_waitlist": {
                  Row: {
                    "categories": (string)[],"consent_version": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: (string)[],"consent_version": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "categories"?: (string)[],"consent_version"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_waitlist_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_accounts": {
                  Row: {
                    "available": number,"generation_suspended_at": string | null,"grant_eligible": boolean,"held": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available"?: number,"generation_suspended_at"?: string | null,"grant_eligible"?: boolean,"held"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "available"?: number,"generation_suspended_at"?: string | null,"grant_eligible"?: boolean,"held"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_accounts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_holds": {
                  Row: {
                    "allocations": NonNullable<Json>,"cell_id": string,"created_at": string,"credits": number,"outcome": string | null,"settled_at": string | null,"state": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocations": NonNullable<Json>,"cell_id": string,"created_at"?: string,"credits": number,"outcome"?: string | null,"settled_at"?: string | null,"state"?: string,"user_id": string
                  }
                  Update: {
                    "allocations"?: NonNullable<Json>,"cell_id"?: string,"created_at"?: string,"credits"?: number,"outcome"?: string | null,"settled_at"?: string | null,"state"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_holds_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_ledger": {
                  Row: {
                    "cell_id": string | null,"created_at": string,"delta": number,"entry_type": string,"id": number,"idem_key": string,"lot_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cell_id"?: string | null,"created_at"?: string,"delta": number,"entry_type": string,"id"?: never,"idem_key": string,"lot_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "cell_id"?: string | null,"created_at"?: string,"delta"?: number,"entry_type"?: string,"id"?: never,"idem_key"?: string,"lot_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_ledger_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "credit_lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_lots": {
                  Row: {
                    "amount": number,"created_at": string,"expires_at": string,"grant_month": string | null,"held": number,"id": string,"kind": string,"remaining": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"expires_at": string,"grant_month"?: string | null,"held"?: number,"id"?: string,"kind": string,"remaining": number,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"expires_at"?: string,"grant_month"?: string | null,"held"?: number,"id"?: string,"kind"?: string,"remaining"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_lots_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlement_version_history": {
                  Row: {
                    "applied_at": string,"entitlement_id": string,"from_version_id": string,"id": number,"to_version_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string,"entitlement_id": string,"from_version_id": string,"id"?: never,"to_version_id": string,"user_id": string
                  }
                  Update: {
                    "applied_at"?: string,"entitlement_id"?: string,"from_version_id"?: string,"id"?: never,"to_version_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlement_version_history_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlement_version_history_from_version_id_fkey"
      columns: ["from_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlement_version_history_to_version_id_fkey"
      columns: ["to_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlement_version_history_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "created_at": string,"id": string,"opened_at": string | null,"recipe_id": string,"revoked_at": string | null,"share_link_id": string | null,"source": string,"user_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"opened_at"?: string | null,"recipe_id": string,"revoked_at"?: string | null,"share_link_id"?: string | null,"source": string,"user_id": string,"version_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"opened_at"?: string | null,"recipe_id"?: string,"revoked_at"?: string | null,"share_link_id"?: string | null,"source"?: string,"user_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "entitlements_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_share_link_id_fkey"
      columns: ["share_link_id"]
isOneToOne: false
      referencedRelation: "share_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"gallery_posts": {
                  Row: {
                    "author_id": string,"created_at": string,"entitlement_id": string | null,"generated_here": boolean,"id": string,"kind": string,"media_id": string | null,"ratio": string | null,"recipe_id": string,"status": string,"title": string,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"entitlement_id"?: string | null,"generated_here"?: boolean,"id"?: string,"kind": string,"media_id"?: string | null,"ratio"?: string | null,"recipe_id": string,"status"?: string,"title": string,"version_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"entitlement_id"?: string | null,"generated_here"?: boolean,"id"?: string,"kind"?: string,"media_id"?: string | null,"ratio"?: string | null,"recipe_id"?: string,"status"?: string,"title"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gallery_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_posts_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_posts_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_posts_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "gallery_posts_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gallery_posts_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"generation_budget": {
                  Row: {
                    "alerted_80_at": string | null,"cap_credits": number,"month": string,"reserved": number,"spent": number,"state": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alerted_80_at"?: string | null,"cap_credits": number,"month": string,"reserved"?: number,"spent"?: number,"state"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alerted_80_at"?: string | null,"cap_credits"?: number,"month"?: string,"reserved"?: number,"spent"?: number,"state"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "code": string,"label": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"label": string,"sort": number
                  }
                  Update: {
                    "code"?: string,"label"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"media_assets": {
                  Row: {
                    "alt_text": string | null,"created_at": string,"id": string,"is_ai_generated": boolean,"kind": string,"owner_id": string,"ratio": string | null,"source": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"created_at"?: string,"id"?: string,"is_ai_generated"?: boolean,"kind": string,"owner_id": string,"ratio"?: string | null,"source"?: string,"storage_path": string
                  }
                  Update: {
                    "alt_text"?: string | null,"created_at"?: string,"id"?: string,"is_ai_generated"?: boolean,"kind"?: string,"owner_id"?: string,"ratio"?: string | null,"source"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "gallery_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "adult_confirmed_at": string | null,"ai_notice_ack_at": string | null,"avatar_url": string | null,"bio": string | null,"created_at": string,"deleted_at": string | null,"expert_badge": string | null,"handle": string,"id": string,"job_codes": (string)[],"nickname": string,"role": string,"terms_accepted_at": string | null,"terms_version": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adult_confirmed_at"?: string | null,"ai_notice_ack_at"?: string | null,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"expert_badge"?: string | null,"handle": string,"id": string,"job_codes"?: (string)[],"nickname": string,"role"?: string,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "adult_confirmed_at"?: string | null,"ai_notice_ack_at"?: string | null,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"expert_badge"?: string | null,"handle"?: string,"id"?: string,"job_codes"?: (string)[],"nickname"?: string,"role"?: string,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ranking_snapshots": {
                  Row: {
                    "category": string,"rank": number,"recipe_id": string,"taken_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"rank": number,"recipe_id": string,"taken_at": string
                  }
                  Update: {
                    "category"?: string,"rank"?: number,"recipe_id"?: string,"taken_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ranking_snapshots_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "ranking_snapshots_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_buckets": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_drafts": {
                  Row: {
                    "category": string | null,"id": string,"owner_id": string,"payload": NonNullable<Json>,"recipe_id": string | null,"step": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"id"?: string,"owner_id": string,"payload"?: NonNullable<Json>,"recipe_id"?: string | null,"step"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string | null,"id"?: string,"owner_id"?: string,"payload"?: NonNullable<Json>,"recipe_id"?: string | null,"step"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_drafts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_drafts_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_drafts_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_likes": {
                  Row: {
                    "created_at": string,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_likes_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_likes_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_version_files": {
                  Row: {
                    "created_at": string,"filename": string,"id": string,"sha256": string | null,"size_bytes": number,"sort": number,"storage_path": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filename": string,"id"?: string,"sha256"?: string | null,"size_bytes": number,"sort"?: number,"storage_path": string,"version_id": string
                  }
                  Update: {
                    "created_at"?: string,"filename"?: string,"id"?: string,"sha256"?: string | null,"size_bytes"?: number,"sort"?: number,"storage_path"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_version_files_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_version_media": {
                  Row: {
                    "media_id": string,"role": string,"sort": number,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "media_id": string,"role"?: string,"sort"?: number,"version_id": string
                  }
                  Update: {
                    "media_id"?: string,"role"?: string,"sort"?: number,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_version_media_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_version_media_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_version_secrets": {
                  Row: {
                    "agent_config": Json | null,"created_at": string,"prompt_body": string | null,"skill_md": string | null,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_config"?: Json | null,"created_at"?: string,"prompt_body"?: string | null,"skill_md"?: string | null,"version_id": string
                  }
                  Update: {
                    "agent_config"?: Json | null,"created_at"?: string,"prompt_body"?: string | null,"skill_md"?: string | null,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_version_secrets_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_versions": {
                  Row: {
                    "approved_at": string | null,"changelog": string,"content_sha256": string | null,"created_at": string,"has_scripts": boolean,"header": Json | null,"id": string,"public_meta": NonNullable<Json>,"recipe_id": string,"review_status": string,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"changelog"?: string,"content_sha256"?: string | null,"created_at"?: string,"has_scripts"?: boolean,"header"?: Json | null,"id"?: string,"public_meta"?: NonNullable<Json>,"recipe_id": string,"review_status"?: string,"version_no": number
                  }
                  Update: {
                    "approved_at"?: string | null,"changelog"?: string,"content_sha256"?: string | null,"created_at"?: string,"has_scripts"?: boolean,"header"?: Json | null,"id"?: string,"public_meta"?: NonNullable<Json>,"recipe_id"?: string,"review_status"?: string,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_versions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_versions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_views": {
                  Row: {
                    "day": string,"recipe_id": string,"visitor_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"recipe_id": string,"visitor_hash": string
                  }
                  Update: {
                    "day"?: string,"recipe_id"?: string,"visitor_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_views_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_views_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "category": string,"created_at": string,"creator_nickname": string,"current_version_id": string | null,"filters": NonNullable<Json>,"fork_allowed": boolean,"forked_from_recipe_id": string | null,"forked_from_version_id": string | null,"id": string,"job_codes": (string)[],"owner_id": string,"price_krw": number,"prompt_kind": string | null,"public_id": string,"published_at": string | null,"search_tags": (string)[],"status": string,"stopped_at": string | null,"stopped_reason": string | null,"summary": string,"title": string,"tool_codes": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"creator_nickname"?: string,"current_version_id"?: string | null,"filters"?: NonNullable<Json>,"fork_allowed"?: boolean,"forked_from_recipe_id"?: string | null,"forked_from_version_id"?: string | null,"id"?: string,"job_codes": (string)[],"owner_id": string,"price_krw"?: number,"prompt_kind"?: string | null,"public_id"?: string,"published_at"?: string | null,"search_tags"?: (string)[],"status"?: string,"stopped_at"?: string | null,"stopped_reason"?: string | null,"summary"?: string,"title": string,"tool_codes"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"creator_nickname"?: string,"current_version_id"?: string | null,"filters"?: NonNullable<Json>,"fork_allowed"?: boolean,"forked_from_recipe_id"?: string | null,"forked_from_version_id"?: string | null,"id"?: string,"job_codes"?: (string)[],"owner_id"?: string,"price_krw"?: number,"prompt_kind"?: string | null,"public_id"?: string,"published_at"?: string | null,"search_tags"?: (string)[],"status"?: string,"stopped_at"?: string | null,"stopped_reason"?: string | null,"summary"?: string,"title"?: string,"tool_codes"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_forked_from_recipe_id_fkey"
      columns: ["forked_from_recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipes_forked_from_recipe_id_fkey"
      columns: ["forked_from_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_forked_from_version_fk"
      columns: ["forked_from_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"review_queue": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": number,"reason": string,"recipe_id": string,"reject_code": string | null,"reject_note": string | null,"requested_visibility": string,"state": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: never,"reason": string,"recipe_id": string,"reject_code"?: string | null,"reject_note"?: string | null,"requested_visibility": string,"state"?: string,"version_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: never,"reason"?: string,"recipe_id"?: string,"reject_code"?: string | null,"reject_note"?: string | null,"requested_visibility"?: string,"state"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_queue_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "review_queue_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_queue_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"search_queries": {
                  Row: {
                    "created_at": string,"id": number,"query_norm": string,"result_count": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"query_norm": string,"result_count": number,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"query_norm"?: string,"result_count"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "search_queries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"share_link_clicks": {
                  Row: {
                    "created_at": string,"id": number,"link_id": string,"visitor_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"link_id": string,"visitor_hash": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"link_id"?: string,"visitor_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_link_clicks_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "share_links"
      referencedColumns: ["id"]
    }
                  ]
                },"share_links": {
                  Row: {
                    "code": string,"created_at": string,"creator_id": string,"id": string,"recipe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"creator_id": string,"id"?: string,"recipe_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"recipe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_links_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "share_links_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "mv_recipe_popularity"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "share_links_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"tools": {
                  Row: {
                    "code": string,"has_api": boolean,"kind": string,"label": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"has_api"?: boolean,"kind": string,"label": string,"sort": number
                  }
                  Update: {
                    "code"?: string,"has_api"?: boolean,"kind"?: string,"label"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "mv_recipe_popularity": {
                  Row: {
                    "category": string | null,"downloads": number | null,"downloads_24h": number | null,"downloads_7d": number | null,"likes": number | null,"owner_id": string | null,"popularity": number | null,"recipe_id": string | null,"refreshed_at": string | null,"same_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "recipes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_signup_terms":
{ Args: { "p_terms_version": string }; Returns: Json
                           },
"admin_decide_review":
{ Args: { "p_actor": string,"p_code"?: string,"p_decision": string,"p_note"?: string,"p_version": string }; Returns: Json
                           },
"apply_update":
{ Args: { "p_entitlement_id": string }; Returns: Json
                           },
"claim_free_recipe":
{ Args: { "p_recipe_id": string,"p_ref_code"?: string }; Returns: Json
                           },
"complete_signup_credits":
{ Args: { "p_device_hash": string,"p_ip_hash": string,"p_user": string }; Returns: Json
                           },
"create_share_link":
{ Args: { "p_code": string,"p_recipe": string }; Returns: Json
                           },
"file_for_download":
{ Args: { "p_file_id": string,"p_version_id": string }; Returns: {
              "filename": string,"storage_path": string
            }[]
                           },
"get_recipe_public":
{ Args: { "p_public_id": string }; Returns: Json
                           },
"hit_judge_budget":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"hit_upload_limit":
{ Args: { "p_user": string }; Returns: string
                           },
"hit_upload_target_limit":
{ Args: { "p_user": string }; Returns: boolean
                           },
"home_creators":
{ Args: { "p_limit"?: number }; Returns: {
              "avatar_url": string,"bio": string,"followers": number,"handle": string,"is_staff": boolean,"nickname": string,"top_public_id": string,"top_title": string
            }[]
                           },
"home_gallery":
{ Args: { "p_limit"?: number }; Returns: {
              "author_nickname": string,"generated_here": boolean,"id": string,"kind": string,"likes": number,"media_kind": string,"ratio": string,"recipe_public_id": string,"recipe_title": string,"title": string
            }[]
                           },
"home_rankings":
{ Args: { "p_category"?: string }; Returns: {
              "category": string,"creator_nickname": string,"filters": Json,"is_new": boolean,"move": number,"price_krw": number,"prompt_kind": string,"public_id": string,"rank": number,"taken_at": string,"title": string
            }[]
                           },
"home_weekly":
{ Args: { "p_limit"?: number }; Returns: {
              "category": string,"creator_handle": string,"creator_nickname": string,"downloads": number,"downloads_7d": number,"filters": Json,"job_codes": (string)[],"likes": number,"popularity": number,"price_krw": number,"prompt_kind": string,"public_id": string,"same_count": number,"summary": string,"title": string,"tool_codes": (string)[]
            }[]
                           },
"my_account_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "adult_confirmed_at": string,"role": string,"signup_complete": boolean,"terms_accepted_at": string,"terms_version": string
            }[]
                           },
"my_credit_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_library":
{ Args: Record<PropertyKey, never>; Returns: {
              "category": string,"claimed_at": string,"creator_nickname": string,"entitlement_id": string,"files": Json,"filters": Json,"latest_changelog": string,"latest_version_no": number,"opened_at": string,"prompt_kind": string,"public_id": string,"recipe_id": string,"status": string,"summary": string,"title": string,"tool_codes": (string)[],"update_available": boolean,"version_id": string,"version_no": number
            }[]
                           },
"my_recipe_for_edit":
{ Args: { "p_recipe": string }; Returns: Json
                           },
"my_recipe_original":
{ Args: { "p_recipe": string }; Returns: Json
                           },
"my_recipe_state":
{ Args: { "p_recipe_id": string }; Returns: Json
                           },
"my_recipes":
{ Args: { "p_days"?: number }; Returns: {
              "category": string,"downloads": number,"link_clicks": number,"links": Json,"pending_version_no": number,"prompt_kind": string,"public_id": string,"recipe_id": string,"reject_code": string,"reject_note": string,"same_count": number,"status": string,"title": string,"updated_at": string,"version_no": number,"views": number
            }[]
                           },
"open_original":
{ Args: { "p_entitlement_id": string }; Returns: Json
                           },
"recipe_search_doc":
{ Args: { "nickname": string,"search_tags": (string)[],"summary": string,"title": string }; Returns: (string)[]
                           },
"record_recipe_view":
{ Args: { "p_public_id": string,"p_visitor_hash": string }; Returns: undefined
                           },
"record_share_click":
{ Args: { "p_code": string,"p_public_id": string,"p_visitor_hash": string }; Returns: string
                           },
"search_recipe_counts":
{ Args: { "p_job"?: string,"p_query"?: string,"p_tool"?: string }; Returns: {
              "category": string,"total": number
            }[]
                           },
"search_recipes":
{ Args: { "p_category"?: string,"p_job"?: string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_sort"?: string,"p_tool"?: string }; Returns: {
              "category": string,"creator_handle": string,"creator_nickname": string,"downloads": number,"filters": Json,"job_codes": (string)[],"likes": number,"popularity": number,"price_krw": number,"prompt_kind": string,"public_id": string,"published_at": string,"same_count": number,"score": number,"summary": string,"title": string,"tool_codes": (string)[],"total_count": number
            }[]
                           },
"set_recipe_visibility":
{ Args: { "p_recipe": string,"p_visibility": string }; Returns: Json
                           },
"similar_recipes":
{ Args: { "p_limit"?: number,"p_public_id": string }; Returns: {
              "category": string,"creator_handle": string,"creator_nickname": string,"downloads": number,"filters": Json,"job_codes": (string)[],"likes": number,"price_krw": number,"prompt_kind": string,"public_id": string,"same_count": number,"summary": string,"title": string,"tool_codes": (string)[]
            }[]
                           },
"submit_recipe_version":
{ Args: { "p_owner": string,"p_payload": Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
