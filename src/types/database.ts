// Generado con `npm run db:types`. No editar a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          code: string
          created_at: string
          id: string
          league_id: string
          max_age: number
          name: string
          recognition_mode: Database["public"]["Enums"]["recognition_mode"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          league_id: string
          max_age: number
          name: string
          recognition_mode?: Database["public"]["Enums"]["recognition_mode"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          league_id?: string
          max_age?: number
          name?: string
          recognition_mode?: Database["public"]["Enums"]["recognition_mode"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          code: string
          id: number
          is_award: boolean
          name: string
          points: number
          sort_order: number
          sport_id: string
        }
        Insert: {
          code: string
          id?: never
          is_award?: boolean
          name: string
          points?: number
          sort_order?: number
          sport_id: string
        }
        Update: {
          code?: string
          id?: never
          is_award?: boolean
          name?: string
          points?: number
          sort_order?: number
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_players: {
        Row: {
          created_at: string
          family_id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          player_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_players_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["league_gender"]
          id: string
          is_active: boolean
          mvp_mode: Database["public"]["Enums"]["mvp_mode"]
          mvp_vote_hours: number
          name: string
          slug: string
          sort_order: number
          sport_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["league_gender"]
          id?: string
          is_active?: boolean
          mvp_mode?: Database["public"]["Enums"]["mvp_mode"]
          mvp_vote_hours?: number
          name: string
          slug: string
          sort_order?: number
          sport_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["league_gender"]
          id?: string
          is_active?: boolean
          mvp_mode?: Database["public"]["Enums"]["mvp_mode"]
          mvp_vote_hours?: number
          name?: string
          slug?: string
          sort_order?: number
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      match_attendance: {
        Row: {
          created_at: string
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          match_id: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          match_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_attendance_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_chronicles: {
        Row: {
          approved_by: string | null
          body: string
          created_at: string
          edited_by: string | null
          generated_at: string | null
          generated_body: string | null
          match_id: string
          model: string | null
          prompt_version: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["chronicle_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          body: string
          created_at?: string
          edited_by?: string | null
          generated_at?: string | null
          generated_body?: string | null
          match_id: string
          model?: string | null
          prompt_version?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["chronicle_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          body?: string
          created_at?: string
          edited_by?: string | null
          generated_at?: string | null
          generated_body?: string | null
          match_id?: string
          model?: string | null
          prompt_version?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["chronicle_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_chronicles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chronicles_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chronicles_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type_id: number
          id: string
          match_id: string
          minute: number | null
          player_id: string
          team_id: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type_id: number
          id?: string
          match_id: string
          minute?: number | null
          player_id: string
          team_id: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type_id?: number
          id?: string
          match_id?: string
          minute?: number | null
          player_id?: string
          team_id?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_mvps: {
        Row: {
          decided_at: string
          decided_by: string | null
          match_id: string
          player_id: string
          source: string
          team_id: string
          votes: number | null
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          match_id: string
          player_id: string
          source: string
          team_id: string
          votes?: number | null
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          match_id?: string
          player_id?: string
          source?: string
          team_id?: string
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_mvps_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_mvps_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_mvps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_mvps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_mvps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_mvps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_mvps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_officials: {
        Row: {
          created_at: string
          match_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          match_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          match_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_officials_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_officials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string
          category_id: string
          created_at: string
          finished_at: string | null
          home_score: number | null
          home_team_id: string
          id: string
          matchday: number | null
          notes: string | null
          season_id: string
          started_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          category_id: string
          created_at?: string
          finished_at?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          matchday?: number | null
          notes?: string | null
          season_id: string
          started_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          category_id?: string
          created_at?: string
          finished_at?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          matchday?: number | null
          notes?: string | null
          season_id?: string
          started_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_season_id_category_id_fkey"
            columns: ["away_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_season_id_category_id_fkey"
            columns: ["away_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_season_id_category_id_fkey"
            columns: ["away_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_season_id_category_id_fkey"
            columns: ["home_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_season_id_category_id_fkey"
            columns: ["home_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_season_id_category_id_fkey"
            columns: ["home_team_id", "season_id", "category_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "season_id", "category_id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          caption: string | null
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          match_id: string
          metadata_stripped: boolean
          mime_type: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["media_status"]
          storage_path: string | null
          thumbnail_path: string | null
          updated_at: string
          upload_path: string | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          match_id: string
          metadata_stripped?: boolean
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          upload_path?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          match_id?: string
          metadata_stripped?: boolean
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          upload_path?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_tags: {
        Row: {
          created_at: string
          media_id: string
          player_id: string
          redacted: boolean
          tagged_by: string | null
        }
        Insert: {
          created_at?: string
          media_id: string
          player_id: string
          redacted?: boolean
          tagged_by?: string | null
        }
        Update: {
          created_at?: string
          media_id?: string
          player_id?: string
          redacted?: boolean
          tagged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_tags_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_tagged_by_fkey"
            columns: ["tagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_votes: {
        Row: {
          created_at: string
          family_id: string
          id: string
          match_id: string
          player_id: string
          team_id: string
          voter_id: string | null
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          match_id: string
          player_id: string
          team_id: string
          voter_id?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          match_id?: string
          player_id?: string
          team_id?: string
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mvp_votes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "mvp_votes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "mvp_votes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: number
          kind: Database["public"]["Enums"]["notification_kind"]
          match_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: never
          kind: Database["public"]["Enums"]["notification_kind"]
          match_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: never
          kind?: Database["public"]["Enums"]["notification_kind"]
          match_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          album_packs: boolean
          final_result: boolean
          match_reminder: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          album_packs?: boolean
          final_result?: boolean
          match_reminder?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          album_packs?: boolean
          final_result?: boolean
          match_reminder?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string
          id: string
          last_initial: string
          photo_consent: boolean
          photo_consent_updated_at: string | null
          photo_consent_updated_by: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name: string
          id?: string
          last_initial: string
          photo_consent?: boolean
          photo_consent_updated_at?: string | null
          photo_consent_updated_by?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string
          id?: string
          last_initial?: string
          photo_consent?: boolean
          photo_consent_updated_at?: string | null
          photo_consent_updated_by?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_entries: {
        Row: {
          created_at: string
          id: string
          jersey_number: number
          player_id: string
          position: string | null
          season_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jersey_number: number
          player_id: string
          position?: string | null
          season_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jersey_number?: number
          player_id?: string
          position?: string | null
          season_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id", "season_id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id", "season_id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "season_id"]
          },
        ]
      }
      seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          name: string
          number: number
          starts_on: string
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          name: string
          number: number
          starts_on: string
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          name?: string
          number?: number
          starts_on?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      sports: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      team_follows: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category_id: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          primary_color: string
          season_id: string
          secondary_color: string
          short_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          primary_color?: string
          season_id: string
          secondary_color?: string
          short_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          primary_color?: string
          season_id?: string
          secondary_color?: string
          short_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          maps_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          maps_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          maps_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      media_review_queue: {
        Row: {
          blocking_tags: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string | null
          kind: Database["public"]["Enums"]["media_kind"] | null
          match_id: string | null
          status: Database["public"]["Enums"]["media_status"] | null
          storage_path: string | null
          tags: number | null
          thumbnail_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          blocking_tags?: never
          created_at?: string | null
          duration_seconds?: number | null
          id?: string | null
          kind?: Database["public"]["Enums"]["media_kind"] | null
          match_id?: string | null
          status?: Database["public"]["Enums"]["media_status"] | null
          storage_path?: string | null
          tags?: never
          thumbnail_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          blocking_tags?: never
          created_at?: string | null
          duration_seconds?: number | null
          id?: string | null
          kind?: Database["public"]["Enums"]["media_kind"] | null
          match_id?: string | null
          status?: Database["public"]["Enums"]["media_status"] | null
          storage_path?: string | null
          tags?: never
          thumbnail_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      my_family_player_stars: {
        Row: {
          assists: number | null
          fair_play: number | null
          goals: number | null
          mvps: number | null
          player_id: string | null
          saves: number | null
          season_id: string | null
          stars: number | null
          team_id: string | null
        }
        Relationships: []
      }
      my_family_season_certificates: {
        Row: {
          assists: number | null
          category_id: string | null
          category_name: string | null
          display_name: string | null
          goals: number | null
          league_name: string | null
          logo_path: string | null
          matches_played: number | null
          mvps: number | null
          participated: boolean | null
          player_id: string | null
          primary_color: string | null
          recognition_mode:
            | Database["public"]["Enums"]["recognition_mode"]
            | null
          season_id: string | null
          season_name: string | null
          stars: number | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id", "season_id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id", "season_id"]
          },
          {
            foreignKeyName: "roster_entries_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "season_id"]
          },
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_stats: {
        Row: {
          assists: number | null
          category_id: string | null
          fair_play: number | null
          goals: number | null
          matches_with_events: number | null
          mvps: number | null
          player_id: string | null
          points: number | null
          red_cards: number | null
          saves: number | null
          season_id: string | null
          team_id: string | null
          yellow_cards: number | null
        }
        Relationships: []
      }
      public_match_scorers: {
        Row: {
          display_name: string | null
          first_minute: number | null
          goals: number | null
          match_id: string | null
          player_id: string | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_season_recognitions"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_players: {
        Row: {
          display_name: string | null
          first_name: string | null
          id: string | null
          last_initial: string | null
          photo_path: string | null
        }
        Insert: {
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_initial?: string | null
          photo_path?: never
        }
        Update: {
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_initial?: string | null
          photo_path?: never
        }
        Relationships: []
      }
      scoring_events: {
        Row: {
          category_id: string | null
          code: string | null
          match_id: string | null
          player_id: string | null
          points: number | null
          season_id: string | null
          team_id: string | null
        }
        Relationships: []
      }
      season_leaders: {
        Row: {
          category_id: string | null
          player_id: string | null
          position: number | null
          season_id: string | null
          stat: string | null
          team_id: string | null
          value: number | null
        }
        Relationships: []
      }
      standings: {
        Row: {
          category_id: string | null
          drawn: number | null
          goal_difference: number | null
          goals_against: number | null
          goals_for: number | null
          lost: number | null
          played: number | null
          points: number | null
          position: number | null
          season_id: string | null
          team_id: string | null
          won: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      team_season_recognitions: {
        Row: {
          category_id: string | null
          fair_play: number | null
          goals: number | null
          mvps: number | null
          season_id: string | null
          stars: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_upload_media: { Args: { p_match_id: string }; Returns: boolean }
      can_view_media: { Args: { p_media_id: string }; Returns: boolean }
      can_view_media_object: { Args: { p_path: string }; Returns: boolean }
      can_view_player_photo: { Args: { p_path: string }; Returns: boolean }
      cast_mvp_vote: {
        Args: { p_match_id: string; p_player_id: string }
        Returns: undefined
      }
      close_expired_mvp_votes: { Args: never; Returns: number }
      close_mvp_voting: { Args: { p_match_id: string }; Returns: undefined }
      finish_match: { Args: { p_match_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_family_member: { Args: { p_family_id: string }; Returns: boolean }
      is_guardian_of: { Args: { p_player_id: string }; Returns: boolean }
      is_league_family: { Args: { p_league_id: string }; Returns: boolean }
      is_match_editable: { Args: { p_match_id: string }; Returns: boolean }
      is_match_family: { Args: { p_match_id: string }; Returns: boolean }
      is_match_official: { Args: { p_match_id: string }; Returns: boolean }
      match_mvp_context: {
        Args: { p_match_id: string }
        Returns: {
          away_team_id: string
          finished_at: string
          home_team_id: string
          mvp_mode: Database["public"]["Enums"]["mvp_mode"]
          status: Database["public"]["Enums"]["match_status"]
          voting_closes_at: string
        }[]
      }
      media_blocking_tags: { Args: { p_media_id: string }; Returns: number }
      set_match_mvp: {
        Args: { p_match_id: string; p_player_id: string }
        Returns: undefined
      }
      set_photo_consent: {
        Args: { p_consent: boolean; p_player_id: string }
        Returns: undefined
      }
      start_match: { Args: { p_match_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "delegate" | "parent"
      chronicle_status: "draft" | "published"
      league_gender: "boys" | "girls" | "mixed"
      match_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled"
      media_kind: "photo" | "video"
      media_status: "processing" | "pending_review" | "approved" | "rejected"
      mvp_mode: "official" | "parent_vote"
      notification_kind: "match_reminder" | "final_result" | "album_packs"
      recognition_mode: "team_stars" | "individual_ranking"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "delegate", "parent"],
      chronicle_status: ["draft", "published"],
      league_gender: ["boys", "girls", "mixed"],
      match_status: ["scheduled", "live", "finished", "postponed", "cancelled"],
      media_kind: ["photo", "video"],
      media_status: ["processing", "pending_review", "approved", "rejected"],
      mvp_mode: ["official", "parent_vote"],
      notification_kind: ["match_reminder", "final_result", "album_packs"],
      recognition_mode: ["team_stars", "individual_ranking"],
    },
  },
} as const

export type AppRole = Database["public"]["Enums"]["app_role"];
