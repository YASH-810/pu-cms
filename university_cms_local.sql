--
-- PostgreSQL database dump
--

\restrict G11kh6Fefe9om2DtAi0Ae6ajnA2JS80PjacPZFCu5FXZiGr14SvQy4xvLrEnWkA

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    content_type_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: content_entities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT content_entities_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'review'::character varying, 'published'::character varying, 'archived'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.content_entities OWNER TO postgres;

--
-- Name: content_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    table_name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.content_types OWNER TO postgres;

--
-- Name: entity_approval_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_approval_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    status_from character varying(50),
    status_to character varying(50) NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid
);


ALTER TABLE public.entity_approval_logs OWNER TO postgres;

--
-- Name: entity_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    performed_by uuid,
    old_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    new_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(100),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid
);


ALTER TABLE public.entity_audit_logs OWNER TO postgres;

--
-- Name: entity_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.entity_categories OWNER TO postgres;

--
-- Name: entity_organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    relation_type character varying(100) DEFAULT 'primary'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.entity_organizations OWNER TO postgres;

--
-- Name: entity_owners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    ownership_type character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT entity_owners_ownership_type_check CHECK (((ownership_type)::text = ANY ((ARRAY['creator'::character varying, 'editor'::character varying, 'reviewer'::character varying, 'publisher'::character varying])::text[])))
);


ALTER TABLE public.entity_owners OWNER TO postgres;

--
-- Name: entity_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.entity_tags OWNER TO postgres;

--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


ALTER TABLE public.knex_migrations OWNER TO postgres;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_id_seq OWNER TO postgres;

--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


ALTER TABLE public.knex_migrations_lock OWNER TO postgres;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNER TO postgres;

--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid,
    entity_id uuid,
    media_type character varying(50) NOT NULL,
    media_category character varying(100),
    media_url character varying(2048) NOT NULL,
    thumbnail_url character varying(2048),
    alt_text text,
    caption text,
    mime_type character varying(255) NOT NULL,
    file_size bigint,
    width integer,
    height integer,
    duration integer,
    display_order integer DEFAULT 1 NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: organization_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_org_id uuid NOT NULL,
    child_org_id uuid NOT NULL,
    relation_type character varying(100) NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.organization_relations OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    org_type character varying(50) NOT NULL,
    parent_id uuid,
    slug character varying(255) NOT NULL,
    short_name character varying(100),
    code character varying(100),
    description text,
    logo_url character varying(2048),
    banner_image character varying(2048),
    contact_email character varying(320),
    contact_phone character varying(50),
    website_url character varying(2048),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT organizations_org_type_check CHECK (((org_type)::text = ANY ((ARRAY['university'::character varying, 'school'::character varying, 'department'::character varying, 'program'::character varying, 'center'::character varying, 'club'::character varying, 'office'::character varying, 'exam_cell'::character varying, 'sports'::character varying])::text[])))
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    module_name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    hierarchy_level integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: saved_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type_id uuid NOT NULL,
    entity_id uuid,
    draft_key character varying(255),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.saved_drafts OWNER TO postgres;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: user_login_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_login_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    login_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address character varying(100),
    user_agent text
);


ALTER TABLE public.user_login_logs OWNER TO postgres;

--
-- Name: user_organization_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_organization_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_from timestamp with time zone,
    assigned_to timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.user_organization_roles OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: user_scope_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_scope_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    organization_id uuid,
    content_type_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.user_scope_permissions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(320) NOT NULL,
    full_name character varying(255) NOT NULL,
    profile_image character varying(2048),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_unique UNIQUE (slug);


--
-- Name: content_entities content_entities_content_type_id_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_entities
    ADD CONSTRAINT content_entities_content_type_id_slug_unique UNIQUE (content_type_id, slug);


--
-- Name: content_entities content_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_entities
    ADD CONSTRAINT content_entities_pkey PRIMARY KEY (id);


--
-- Name: content_types content_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_name_unique UNIQUE (name);


--
-- Name: content_types content_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_pkey PRIMARY KEY (id);


--
-- Name: content_types content_types_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_slug_unique UNIQUE (slug);


--
-- Name: content_types content_types_table_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_table_name_unique UNIQUE (table_name);


--
-- Name: entity_approval_logs entity_approval_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_approval_logs
    ADD CONSTRAINT entity_approval_logs_pkey PRIMARY KEY (id);


--
-- Name: entity_audit_logs entity_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit_logs
    ADD CONSTRAINT entity_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: entity_categories entity_categories_content_type_id_entity_id_category_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_content_type_id_entity_id_category_id_unique UNIQUE (content_type_id, entity_id, category_id);


--
-- Name: entity_categories entity_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_pkey PRIMARY KEY (id);


--
-- Name: entity_organizations entity_organizations_content_type_id_entity_id_organization_id_; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_content_type_id_entity_id_organization_id_ UNIQUE (content_type_id, entity_id, organization_id, relation_type);


--
-- Name: entity_organizations entity_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_pkey PRIMARY KEY (id);


--
-- Name: entity_owners entity_owners_content_type_id_entity_id_user_id_ownership_type_; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_content_type_id_entity_id_user_id_ownership_type_ UNIQUE (content_type_id, entity_id, user_id, ownership_type);


--
-- Name: entity_owners entity_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_pkey PRIMARY KEY (id);


--
-- Name: entity_tags entity_tags_content_type_id_entity_id_tag_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_content_type_id_entity_id_tag_id_unique UNIQUE (content_type_id, entity_id, tag_id);


--
-- Name: entity_tags entity_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: organization_relations organization_relations_parent_org_id_child_org_id_relation_type; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_parent_org_id_child_org_id_relation_type UNIQUE (parent_org_id, child_org_id, relation_type);


--
-- Name: organization_relations organization_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: permissions permissions_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_unique UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_unique UNIQUE (role_id, permission_id);


--
-- Name: roles roles_hierarchy_level_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_hierarchy_level_unique UNIQUE (hierarchy_level);


--
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: saved_drafts saved_drafts_content_type_id_entity_id_draft_key_created_by_uni; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_content_type_id_entity_id_draft_key_created_by_uni UNIQUE (content_type_id, entity_id, draft_key, created_by);


--
-- Name: saved_drafts saved_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_pkey PRIMARY KEY (id);


--
-- Name: tags tags_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_unique UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_slug_unique UNIQUE (slug);


--
-- Name: user_login_logs user_login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_login_logs
    ADD CONSTRAINT user_login_logs_pkey PRIMARY KEY (id);


--
-- Name: user_organization_roles user_organization_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_pkey PRIMARY KEY (id);


--
-- Name: user_organization_roles user_organization_roles_user_id_organization_id_role_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_user_id_organization_id_role_id_unique UNIQUE (user_id, organization_id, role_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_unique UNIQUE (user_id, role_id);


--
-- Name: user_scope_permissions user_scope_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_scope_permissions user_scope_permissions_user_id_permission_id_organization_id_co; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_user_id_permission_id_organization_id_co UNIQUE (user_id, permission_id, organization_id, content_type_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: categories_content_type_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_content_type_id_index ON public.categories USING btree (content_type_id);


--
-- Name: categories_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_deleted_at_index ON public.categories USING btree (deleted_at);


--
-- Name: categories_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_is_active_index ON public.categories USING btree (is_active);


--
-- Name: content_entities_content_type_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_entities_content_type_id_index ON public.content_entities USING btree (content_type_id);


--
-- Name: content_entities_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_entities_deleted_at_index ON public.content_entities USING btree (deleted_at);


--
-- Name: content_entities_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_entities_status_index ON public.content_entities USING btree (status);


--
-- Name: content_types_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_types_deleted_at_index ON public.content_types USING btree (deleted_at);


--
-- Name: content_types_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_types_is_active_index ON public.content_types USING btree (is_active);


--
-- Name: entity_approval_logs_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_approval_logs_content_type_id_entity_id_index ON public.entity_approval_logs USING btree (content_type_id, entity_id);


--
-- Name: entity_approval_logs_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_approval_logs_created_at_index ON public.entity_approval_logs USING btree (created_at);


--
-- Name: entity_approval_logs_status_to_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_approval_logs_status_to_index ON public.entity_approval_logs USING btree (status_to);


--
-- Name: entity_audit_logs_action_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_audit_logs_action_index ON public.entity_audit_logs USING btree (action);


--
-- Name: entity_audit_logs_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_audit_logs_content_type_id_entity_id_index ON public.entity_audit_logs USING btree (content_type_id, entity_id);


--
-- Name: entity_audit_logs_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_audit_logs_created_at_index ON public.entity_audit_logs USING btree (created_at);


--
-- Name: entity_categories_category_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_categories_category_id_index ON public.entity_categories USING btree (category_id);


--
-- Name: entity_categories_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_categories_content_type_id_entity_id_index ON public.entity_categories USING btree (content_type_id, entity_id);


--
-- Name: entity_categories_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_categories_deleted_at_index ON public.entity_categories USING btree (deleted_at);


--
-- Name: entity_organizations_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_organizations_content_type_id_entity_id_index ON public.entity_organizations USING btree (content_type_id, entity_id);


--
-- Name: entity_organizations_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_organizations_deleted_at_index ON public.entity_organizations USING btree (deleted_at);


--
-- Name: entity_organizations_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_organizations_organization_id_index ON public.entity_organizations USING btree (organization_id);


--
-- Name: entity_owners_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_owners_content_type_id_entity_id_index ON public.entity_owners USING btree (content_type_id, entity_id);


--
-- Name: entity_owners_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_owners_deleted_at_index ON public.entity_owners USING btree (deleted_at);


--
-- Name: entity_owners_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_owners_user_id_index ON public.entity_owners USING btree (user_id);


--
-- Name: entity_tags_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_tags_content_type_id_entity_id_index ON public.entity_tags USING btree (content_type_id, entity_id);


--
-- Name: entity_tags_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_tags_deleted_at_index ON public.entity_tags USING btree (deleted_at);


--
-- Name: entity_tags_tag_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_tags_tag_id_index ON public.entity_tags USING btree (tag_id);


--
-- Name: media_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_content_type_id_entity_id_index ON public.media USING btree (content_type_id, entity_id);


--
-- Name: media_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_deleted_at_index ON public.media USING btree (deleted_at);


--
-- Name: media_is_featured_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_is_featured_index ON public.media USING btree (is_featured);


--
-- Name: media_media_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_media_type_index ON public.media USING btree (media_type);


--
-- Name: organization_relations_child_org_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_relations_child_org_id_index ON public.organization_relations USING btree (child_org_id);


--
-- Name: organization_relations_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_relations_deleted_at_index ON public.organization_relations USING btree (deleted_at);


--
-- Name: organization_relations_parent_org_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_relations_parent_org_id_index ON public.organization_relations USING btree (parent_org_id);


--
-- Name: organizations_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organizations_deleted_at_index ON public.organizations USING btree (deleted_at);


--
-- Name: organizations_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organizations_is_active_index ON public.organizations USING btree (is_active);


--
-- Name: organizations_org_type_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organizations_org_type_index ON public.organizations USING btree (org_type);


--
-- Name: organizations_parent_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organizations_parent_id_index ON public.organizations USING btree (parent_id);


--
-- Name: permissions_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permissions_deleted_at_index ON public.permissions USING btree (deleted_at);


--
-- Name: permissions_module_name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permissions_module_name_index ON public.permissions USING btree (module_name);


--
-- Name: role_permissions_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_permissions_deleted_at_index ON public.role_permissions USING btree (deleted_at);


--
-- Name: role_permissions_permission_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_permissions_permission_id_index ON public.role_permissions USING btree (permission_id);


--
-- Name: role_permissions_role_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_permissions_role_id_index ON public.role_permissions USING btree (role_id);


--
-- Name: roles_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX roles_deleted_at_index ON public.roles USING btree (deleted_at);


--
-- Name: saved_drafts_content_type_id_entity_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX saved_drafts_content_type_id_entity_id_index ON public.saved_drafts USING btree (content_type_id, entity_id);


--
-- Name: saved_drafts_created_by_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX saved_drafts_created_by_index ON public.saved_drafts USING btree (created_by);


--
-- Name: saved_drafts_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX saved_drafts_deleted_at_index ON public.saved_drafts USING btree (deleted_at);


--
-- Name: tags_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tags_deleted_at_index ON public.tags USING btree (deleted_at);


--
-- Name: tags_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tags_is_active_index ON public.tags USING btree (is_active);


--
-- Name: user_login_logs_login_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_login_logs_login_at_index ON public.user_login_logs USING btree (login_at);


--
-- Name: user_login_logs_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_login_logs_user_id_index ON public.user_login_logs USING btree (user_id);


--
-- Name: user_organization_roles_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_organization_roles_deleted_at_index ON public.user_organization_roles USING btree (deleted_at);


--
-- Name: user_organization_roles_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_organization_roles_is_active_index ON public.user_organization_roles USING btree (is_active);


--
-- Name: user_organization_roles_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_organization_roles_organization_id_index ON public.user_organization_roles USING btree (organization_id);


--
-- Name: user_organization_roles_role_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_organization_roles_role_id_index ON public.user_organization_roles USING btree (role_id);


--
-- Name: user_organization_roles_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_organization_roles_user_id_index ON public.user_organization_roles USING btree (user_id);


--
-- Name: user_roles_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_roles_deleted_at_index ON public.user_roles USING btree (deleted_at);


--
-- Name: user_roles_role_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_roles_role_id_index ON public.user_roles USING btree (role_id);


--
-- Name: user_roles_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_roles_user_id_index ON public.user_roles USING btree (user_id);


--
-- Name: user_scope_permissions_content_type_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_scope_permissions_content_type_id_index ON public.user_scope_permissions USING btree (content_type_id);


--
-- Name: user_scope_permissions_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_scope_permissions_deleted_at_index ON public.user_scope_permissions USING btree (deleted_at);


--
-- Name: user_scope_permissions_organization_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_scope_permissions_organization_id_index ON public.user_scope_permissions USING btree (organization_id);


--
-- Name: user_scope_permissions_permission_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_scope_permissions_permission_id_index ON public.user_scope_permissions USING btree (permission_id);


--
-- Name: user_scope_permissions_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_scope_permissions_user_id_index ON public.user_scope_permissions USING btree (user_id);


--
-- Name: users_deleted_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_deleted_at_index ON public.users USING btree (deleted_at);


--
-- Name: users_email_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_email_index ON public.users USING btree (email);


--
-- Name: users_is_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_is_active_index ON public.users USING btree (is_active);


--
-- Name: categories categories_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE SET NULL;


--
-- Name: categories categories_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: categories categories_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_entities content_entities_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_entities
    ADD CONSTRAINT content_entities_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: content_entities content_entities_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_entities
    ADD CONSTRAINT content_entities_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_entities content_entities_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_entities
    ADD CONSTRAINT content_entities_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_types content_types_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_types content_types_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_approval_logs entity_approval_logs_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_approval_logs
    ADD CONSTRAINT entity_approval_logs_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_approval_logs entity_approval_logs_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_approval_logs
    ADD CONSTRAINT entity_approval_logs_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_audit_logs entity_audit_logs_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit_logs
    ADD CONSTRAINT entity_audit_logs_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_audit_logs entity_audit_logs_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit_logs
    ADD CONSTRAINT entity_audit_logs_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_audit_logs entity_audit_logs_performed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit_logs
    ADD CONSTRAINT entity_audit_logs_performed_by_foreign FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_categories entity_categories_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: entity_categories entity_categories_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_categories entity_categories_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_categories entity_categories_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_categories
    ADD CONSTRAINT entity_categories_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_organizations entity_organizations_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_organizations entity_organizations_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_organizations entity_organizations_organization_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: entity_organizations entity_organizations_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_organizations
    ADD CONSTRAINT entity_organizations_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_owners entity_owners_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_owners entity_owners_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_owners entity_owners_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_owners entity_owners_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_owners
    ADD CONSTRAINT entity_owners_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: entity_tags entity_tags_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: entity_tags entity_tags_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_tags entity_tags_tag_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_tag_id_foreign FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: entity_tags entity_tags_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media media_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE SET NULL;


--
-- Name: media media_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media media_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: media media_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_relations organization_relations_child_org_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_child_org_id_foreign FOREIGN KEY (child_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_relations organization_relations_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_relations organization_relations_parent_org_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_parent_org_id_foreign FOREIGN KEY (parent_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_relations organization_relations_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organizations organizations_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organizations organizations_parent_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_parent_id_foreign FOREIGN KEY (parent_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: organizations organizations_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: permissions permissions_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: permissions permissions_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: roles roles_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: roles roles_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: saved_drafts saved_drafts_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: saved_drafts saved_drafts_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: saved_drafts saved_drafts_entity_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_entity_id_foreign FOREIGN KEY (entity_id) REFERENCES public.content_entities(id) ON DELETE CASCADE;


--
-- Name: saved_drafts saved_drafts_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_drafts
    ADD CONSTRAINT saved_drafts_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tags tags_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tags tags_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_login_logs user_login_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_login_logs
    ADD CONSTRAINT user_login_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_organization_roles user_organization_roles_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_organization_roles user_organization_roles_organization_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organization_roles user_organization_roles_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_organization_roles user_organization_roles_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_organization_roles user_organization_roles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organization_roles
    ADD CONSTRAINT user_organization_roles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_scope_permissions user_scope_permissions_content_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_content_type_id_foreign FOREIGN KEY (content_type_id) REFERENCES public.content_types(id) ON DELETE CASCADE;


--
-- Name: user_scope_permissions user_scope_permissions_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_scope_permissions user_scope_permissions_organization_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_scope_permissions user_scope_permissions_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: user_scope_permissions user_scope_permissions_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_scope_permissions user_scope_permissions_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_scope_permissions
    ADD CONSTRAINT user_scope_permissions_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict G11kh6Fefe9om2DtAi0Ae6ajnA2JS80PjacPZFCu5FXZiGr14SvQy4xvLrEnWkA

