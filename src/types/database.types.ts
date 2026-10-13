
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
            "banners": {
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
                },"entitlements": {
                  Row: {
                    "created_at": string,"id": string,"opened_at": string | null,"recipe_id": string,"revoked_at": string | null,"source": string,"user_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"opened_at"?: string | null,"recipe_id": string,"revoked_at"?: string | null,"source": string,"user_id": string,"version_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"opened_at"?: string | null,"recipe_id"?: string,"revoked_at"?: string | null,"source"?: string,"user_id"?: string,"version_id"?: string
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
                    "adult_confirmed_at": string | null,"ai_notice_ack_at": string | null,"avatar_url": string | null,"bio": string | null,"created_at": string,"deleted_at": string | null,"handle": string,"id": string,"job_codes": (string)[],"nickname": string,"role": string,"terms_accepted_at": string | null,"terms_version": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adult_confirmed_at"?: string | null,"ai_notice_ack_at"?: string | null,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"handle": string,"id": string,"job_codes"?: (string)[],"nickname": string,"role"?: string,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "adult_confirmed_at"?: string | null,"ai_notice_ack_at"?: string | null,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"handle"?: string,"id"?: string,"job_codes"?: (string)[],"nickname"?: string,"role"?: string,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string
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
                    "approved_at": string | null,"changelog": string,"content_sha256": string | null,"created_at": string,"has_scripts": boolean,"id": string,"public_meta": NonNullable<Json>,"recipe_id": string,"review_status": string,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"changelog"?: string,"content_sha256"?: string | null,"created_at"?: string,"has_scripts"?: boolean,"id"?: string,"public_meta"?: NonNullable<Json>,"recipe_id": string,"review_status"?: string,"version_no": number
                  }
                  Update: {
                    "approved_at"?: string | null,"changelog"?: string,"content_sha256"?: string | null,"created_at"?: string,"has_scripts"?: boolean,"id"?: string,"public_meta"?: NonNullable<Json>,"recipe_id"?: string,"review_status"?: string,"version_no"?: number
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
                },"recipes": {
                  Row: {
                    "category": string,"created_at": string,"creator_nickname": string,"current_version_id": string | null,"filters": NonNullable<Json>,"fork_allowed": boolean,"forked_from_recipe_id": string | null,"forked_from_version_id": string | null,"id": string,"job_codes": (string)[],"owner_id": string,"price_krw": number,"prompt_kind": string | null,"public_id": string,"published_at": string | null,"search_tags": (string)[],"status": string,"summary": string,"title": string,"tool_codes": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"creator_nickname"?: string,"current_version_id"?: string | null,"filters"?: NonNullable<Json>,"fork_allowed"?: boolean,"forked_from_recipe_id"?: string | null,"forked_from_version_id"?: string | null,"id"?: string,"job_codes": (string)[],"owner_id": string,"price_krw"?: number,"prompt_kind"?: string | null,"public_id"?: string,"published_at"?: string | null,"search_tags"?: (string)[],"status"?: string,"summary"?: string,"title": string,"tool_codes"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"creator_nickname"?: string,"current_version_id"?: string | null,"filters"?: NonNullable<Json>,"fork_allowed"?: boolean,"forked_from_recipe_id"?: string | null,"forked_from_version_id"?: string | null,"id"?: string,"job_codes"?: (string)[],"owner_id"?: string,"price_krw"?: number,"prompt_kind"?: string | null,"public_id"?: string,"published_at"?: string | null,"search_tags"?: (string)[],"status"?: string,"summary"?: string,"title"?: string,"tool_codes"?: (string)[],"updated_at"?: string
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
"recipe_search_doc":
{ Args: { "nickname": string,"search_tags": (string)[],"summary": string,"title": string }; Returns: (string)[]
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
