--
-- PostgreSQL database dump
--

-- Dumped from database version 16.6 (Ubuntu 16.6-1.pgdg20.04+1)
-- Dumped by pg_dump version 16.6 (Ubuntu 16.6-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: azure_pg_admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO azure_pg_admin;

--
-- Name: DecisionCategory; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DecisionCategory" AS ENUM (
    'DESTINATION',
    'DATES',
    'HOTEL',
    'TRANSPORT',
    'ACTIVITY',
    'BUDGET',
    'OTHER'
);


ALTER TYPE public."DecisionCategory" OWNER TO postgres;

--
-- Name: DecisionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DecisionStatus" AS ENUM (
    'VOTING',
    'DECIDED'
);


ALTER TYPE public."DecisionStatus" OWNER TO postgres;

--
-- Name: DecisionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DecisionType" AS ENUM (
    'YES_NO',
    'SINGLE_CHOICE',
    'MULTI_CHOICE',
    'TOP3'
);


ALTER TYPE public."DecisionType" OWNER TO postgres;

--
-- Name: MemberRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MemberRole" AS ENUM (
    'ADMIN',
    'MEMBER'
);


ALTER TYPE public."MemberRole" OWNER TO postgres;

--
-- Name: TripLinkStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TripLinkStatus" AS ENUM (
    'SAVED',
    'PENDING',
    'BOOKED',
    'PAID',
    'MISSING',
    'CANCELLED'
);


ALTER TYPE public."TripLinkStatus" OWNER TO postgres;

--
-- Name: TripLinkType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TripLinkType" AS ENUM (
    'FLIGHT',
    'HOTEL',
    'CAR',
    'ACTIVITY',
    'RESTAURANT',
    'BAR',
    'MAP',
    'INSURANCE',
    'DOCUMENT',
    'PAYMENT',
    'OTHER'
);


ALTER TYPE public."TripLinkType" OWNER TO postgres;

--
-- Name: TripStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TripStatus" AS ENUM (
    'PLAN',
    'LIVE',
    'FINISHED',
    'CANCELED'
);


ALTER TYPE public."TripStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Decision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Decision" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    title text NOT NULL,
    description text,
    category public."DecisionCategory" DEFAULT 'OTHER'::public."DecisionCategory" NOT NULL,
    status public."DecisionStatus" DEFAULT 'VOTING'::public."DecisionStatus" NOT NULL,
    type public."DecisionType" NOT NULL,
    "finalDecision" text,
    "finalOptionId" text,
    "dueDate" timestamp(3) without time zone,
    "actionNote" text,
    "createdByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "decidedAt" timestamp(3) without time zone,
    "isSecretVote" boolean DEFAULT false NOT NULL,
    "hideResultsUntilClosed" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Decision" OWNER TO postgres;

--
-- Name: DecisionOption; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DecisionOption" (
    id text NOT NULL,
    "decisionId" text NOT NULL,
    text text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DecisionOption" OWNER TO postgres;

--
-- Name: DecisionVote; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DecisionVote" (
    id text NOT NULL,
    "decisionId" text NOT NULL,
    "optionId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    rank integer
);


ALTER TABLE public."DecisionVote" OWNER TO postgres;

--
-- Name: ExpenseParticipant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExpenseParticipant" (
    id text NOT NULL,
    "expenseId" text NOT NULL,
    "userId" text NOT NULL
);


ALTER TABLE public."ExpenseParticipant" OWNER TO postgres;

--
-- Name: PlacePhoto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlacePhoto" (
    id text NOT NULL,
    "placeId" text NOT NULL,
    url text NOT NULL,
    caption text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PlacePhoto" OWNER TO postgres;

--
-- Name: PlannerActivity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlannerActivity" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    name text NOT NULL,
    emoji text DEFAULT '📌'::text NOT NULL,
    location text,
    description text,
    "durationMins" integer DEFAULT 60 NOT NULL,
    cost text,
    category text DEFAULT 'other'::text NOT NULL,
    "mapsUrl" text,
    color text DEFAULT 'blue'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    url text
);


ALTER TABLE public."PlannerActivity" OWNER TO postgres;

--
-- Name: PlannerActivityFile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlannerActivityFile" (
    id text NOT NULL,
    "activityId" text NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text DEFAULT 'application/octet-stream'::text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PlannerActivityFile" OWNER TO postgres;

--
-- Name: PlannerActivityVote; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlannerActivityVote" (
    id text NOT NULL,
    "activityId" text NOT NULL,
    "tripId" text NOT NULL,
    "userId" text NOT NULL,
    vote text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PlannerActivityVote" OWNER TO postgres;

--
-- Name: PlannerEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlannerEvent" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    "activityId" text,
    title text NOT NULL,
    date text NOT NULL,
    "startMinute" integer DEFAULT 0 NOT NULL,
    "durationMins" integer DEFAULT 60 NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "allDay" boolean DEFAULT false NOT NULL,
    url text,
    "mapsUrl" text,
    cost text
);


ALTER TABLE public."PlannerEvent" OWNER TO postgres;

--
-- Name: PlannerEventFile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlannerEventFile" (
    id text NOT NULL,
    "eventId" text NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text DEFAULT 'application/octet-stream'::text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PlannerEventFile" OWNER TO postgres;

--
-- Name: Trip; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Trip" (
    id text NOT NULL,
    name text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    status public."TripStatus" DEFAULT 'PLAN'::public."TripStatus" NOT NULL,
    "inviteCode" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "defaultCurrency" text DEFAULT 'ILS'::text NOT NULL,
    "ownerId" text DEFAULT ''::text NOT NULL
);


ALTER TABLE public."Trip" OWNER TO postgres;

--
-- Name: TripExpense; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TripExpense" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    "paidByUserId" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'ILS'::text NOT NULL,
    "exchangeRate" double precision DEFAULT 1 NOT NULL,
    "amountILS" double precision NOT NULL,
    description text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expenseDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TripExpense" OWNER TO postgres;

--
-- Name: TripLink; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TripLink" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    title text NOT NULL,
    description text,
    url text,
    type public."TripLinkType" DEFAULT 'OTHER'::public."TripLinkType" NOT NULL,
    status public."TripLinkStatus" DEFAULT 'SAVED'::public."TripLinkStatus" NOT NULL,
    "providerName" text,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "estimatedCost" double precision,
    currency text,
    "responsibleUserId" text,
    notes text,
    "isPinned" boolean DEFAULT false NOT NULL,
    "decisionId" text,
    "createdByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isPrivate" boolean DEFAULT false NOT NULL,
    "fileUrl" text,
    "fileName" text
);


ALTER TABLE public."TripLink" OWNER TO postgres;

--
-- Name: TripMember; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TripMember" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tripId" text NOT NULL,
    role public."MemberRole" DEFAULT 'MEMBER'::public."MemberRole" NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TripMember" OWNER TO postgres;

--
-- Name: TripPlace; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TripPlace" (
    id text NOT NULL,
    "tripId" text NOT NULL,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    notes text,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mapsUrl" text,
    date text,
    category text DEFAULT 'other'::text NOT NULL
);


ALTER TABLE public."TripPlace" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "avatarUrl" text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Decision; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Decision" (id, "tripId", title, description, category, status, type, "finalDecision", "finalOptionId", "dueDate", "actionNote", "createdByUserId", "createdAt", "updatedAt", "decidedAt", "isSecretVote", "hideResultsUntilClosed") FROM stdin;
e7f469e2-5560-4a77-989a-81c3263aca0b	b389876f-9a01-4dda-b3a5-6b673a789468	לאן טסים	תדרג טופ 3 יעדים	DESTINATION	DECIDED	TOP3	היער השחור	\N	\N	\N	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-13 07:08:40.302	2026-06-13 15:00:02.648	2026-06-13 15:00:02.647	t	t
12bc8975-1c4c-48b1-81b6-9be183174c69	b389876f-9a01-4dda-b3a5-6b673a789468	טיסה - הזמנה יחד או לחוד	\N	OTHER	VOTING	SINGLE_CHOICE	\N	\N	\N	\N	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-17 13:44:57.429	2026-06-17 13:44:57.429	\N	f	f
07cd5636-dff8-4849-bb2e-de78d40647ad	b389876f-9a01-4dda-b3a5-6b673a789468	מלונות ביער	\N	OTHER	VOTING	MULTI_CHOICE	\N	\N	\N	\N	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-17 14:05:05.456	2026-06-17 14:05:05.456	\N	f	f
d46a5b0d-414d-4e0c-8211-0e53918cc162	b389876f-9a01-4dda-b3a5-6b673a789468	מאיפה הטיול יתחיל	\N	OTHER	DECIDED	MULTI_CHOICE	בזל	\N	\N	\N	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-17 14:00:55.09	2026-06-22 17:37:49.275	2026-06-22 17:37:49.274	f	f
\.


--
-- Data for Name: DecisionOption; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DecisionOption" (id, "decisionId", text, description, "createdAt") FROM stdin;
d0502a95-10c4-4576-a235-0b43a92195d3	e7f469e2-5560-4a77-989a-81c3263aca0b	גיאורגיה	\N	2026-06-13 07:08:40.302
d1050916-b55b-4666-aec1-ba31e9e121f6	e7f469e2-5560-4a77-989a-81c3263aca0b	היער השחור	\N	2026-06-13 07:08:40.302
e19eac85-63f0-40e2-8b77-bfdf807917df	e7f469e2-5560-4a77-989a-81c3263aca0b	ורשה	\N	2026-06-13 07:08:40.302
fc8c6d53-bf04-49e0-9be3-477ffd86bb9e	12bc8975-1c4c-48b1-81b6-9be183174c69	יחד	\N	2026-06-17 13:44:57.429
e9c414f1-38e7-412c-843b-d373824229c1	12bc8975-1c4c-48b1-81b6-9be183174c69	לחוד	\N	2026-06-17 13:44:57.429
f2c65504-ea68-4dee-b4a9-dc235b414d9c	12bc8975-1c4c-48b1-81b6-9be183174c69	לא משנה לי	\N	2026-06-17 13:47:38.249
77a52d5d-d906-47a7-a833-339e958efb8a	d46a5b0d-414d-4e0c-8211-0e53918cc162	בזל	\N	2026-06-17 14:00:55.09
99b69bf0-c617-47ef-b7b4-4af4971e66a6	d46a5b0d-414d-4e0c-8211-0e53918cc162	ציריך	\N	2026-06-17 14:00:55.09
e68b90b6-f4e0-4af8-a983-c451e2dd5586	d46a5b0d-414d-4e0c-8211-0e53918cc162	מינכן	\N	2026-06-17 14:00:55.09
0d399137-f293-4a9d-bf4f-d152b86da577	07cd5636-dff8-4849-bb2e-de78d40647ad	1 - משם ניסע לאן שנרצה	\N	2026-06-17 14:05:05.456
2f45e526-69d9-425a-968c-bee3f7a013eb	07cd5636-dff8-4849-bb2e-de78d40647ad	2 - שנוכל להיות באיזורים שונים	\N	2026-06-17 14:05:05.456
\.


--
-- Data for Name: DecisionVote; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DecisionVote" (id, "decisionId", "optionId", "userId", "createdAt", "updatedAt", rank) FROM stdin;
ad010c58-5875-4629-a9ae-9226ad241237	e7f469e2-5560-4a77-989a-81c3263aca0b	d1050916-b55b-4666-aec1-ba31e9e121f6	0114313b-35d5-4106-a698-4f0d59c178e5	2026-06-13 08:54:36.174	2026-06-13 08:54:36.174	1
17d9dec9-3973-4e55-949a-a901548b539d	e7f469e2-5560-4a77-989a-81c3263aca0b	d0502a95-10c4-4576-a235-0b43a92195d3	0114313b-35d5-4106-a698-4f0d59c178e5	2026-06-13 08:54:36.177	2026-06-13 08:54:36.177	2
03de53cf-d7a6-43ed-a16c-54b57249cb79	e7f469e2-5560-4a77-989a-81c3263aca0b	e19eac85-63f0-40e2-8b77-bfdf807917df	0114313b-35d5-4106-a698-4f0d59c178e5	2026-06-13 08:54:36.178	2026-06-13 08:54:36.178	3
73944a4d-756a-4558-ad1d-443f5362fe5b	e7f469e2-5560-4a77-989a-81c3263aca0b	d0502a95-10c4-4576-a235-0b43a92195d3	fa102463-a816-4a12-945d-cb3d479c694e	2026-06-13 14:24:54.838	2026-06-13 14:24:54.838	1
d2cbd2bb-4068-42e6-b780-e5b8b575ca22	e7f469e2-5560-4a77-989a-81c3263aca0b	e19eac85-63f0-40e2-8b77-bfdf807917df	fa102463-a816-4a12-945d-cb3d479c694e	2026-06-13 14:24:54.841	2026-06-13 14:24:54.841	2
d27eb6f6-d1f9-46c4-90de-ffcffae9eb3f	e7f469e2-5560-4a77-989a-81c3263aca0b	d1050916-b55b-4666-aec1-ba31e9e121f6	fa102463-a816-4a12-945d-cb3d479c694e	2026-06-13 14:24:54.842	2026-06-13 14:24:54.842	3
56ba998b-3f0a-4b0d-bae4-bda2feb84c60	e7f469e2-5560-4a77-989a-81c3263aca0b	d1050916-b55b-4666-aec1-ba31e9e121f6	63bb1ed9-432c-4638-bad3-50196226451c	2026-06-13 14:29:22.119	2026-06-13 14:29:22.119	1
12bedf9d-01ff-4187-8ece-644ff5668093	e7f469e2-5560-4a77-989a-81c3263aca0b	d0502a95-10c4-4576-a235-0b43a92195d3	63bb1ed9-432c-4638-bad3-50196226451c	2026-06-13 14:29:22.121	2026-06-13 14:29:22.121	2
0662382b-d81b-4a33-b467-6d1b73ea1c11	e7f469e2-5560-4a77-989a-81c3263aca0b	e19eac85-63f0-40e2-8b77-bfdf807917df	63bb1ed9-432c-4638-bad3-50196226451c	2026-06-13 14:29:22.123	2026-06-13 14:29:22.123	3
fdd0314d-7f89-4f23-a3e6-bc218b1ffdad	e7f469e2-5560-4a77-989a-81c3263aca0b	e19eac85-63f0-40e2-8b77-bfdf807917df	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-13 14:36:14.174	2026-06-13 14:36:14.174	1
d0047fe8-bb24-4988-a808-97cb26dc6372	e7f469e2-5560-4a77-989a-81c3263aca0b	d1050916-b55b-4666-aec1-ba31e9e121f6	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-13 14:36:14.179	2026-06-13 14:36:14.179	2
50919482-883c-4433-b5ec-294f5ee3a4ea	e7f469e2-5560-4a77-989a-81c3263aca0b	d0502a95-10c4-4576-a235-0b43a92195d3	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-13 14:36:14.182	2026-06-13 14:36:14.182	3
cf93f713-9219-4ceb-be42-7d0437decb5b	12bc8975-1c4c-48b1-81b6-9be183174c69	f2c65504-ea68-4dee-b4a9-dc235b414d9c	0114313b-35d5-4106-a698-4f0d59c178e5	2026-06-17 13:47:39.003	2026-06-17 13:47:39.003	\N
0e51277c-f6d3-4e7e-8bb5-fc80439d004a	12bc8975-1c4c-48b1-81b6-9be183174c69	f2c65504-ea68-4dee-b4a9-dc235b414d9c	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-17 13:54:26.236	2026-06-17 13:54:26.236	\N
e2849cf7-2ed4-4c4d-8f7f-52549715913a	12bc8975-1c4c-48b1-81b6-9be183174c69	fc8c6d53-bf04-49e0-9be3-477ffd86bb9e	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-17 13:58:28.211	2026-06-17 13:58:28.211	\N
7e0fb1fe-7756-4601-a69b-c558a94bc15a	07cd5636-dff8-4849-bb2e-de78d40647ad	0d399137-f293-4a9d-bf4f-d152b86da577	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	2026-06-17 14:09:32.222	2026-06-17 14:09:32.222	\N
4f2fb9a2-99df-41ec-90da-8f4f4d5fd598	e7f469e2-5560-4a77-989a-81c3263aca0b	d1050916-b55b-4666-aec1-ba31e9e121f6	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-13 07:08:46.674	2026-06-13 07:08:46.674	1
eaccd3c1-0410-4b10-b9f9-264cdad8aeda	e7f469e2-5560-4a77-989a-81c3263aca0b	e19eac85-63f0-40e2-8b77-bfdf807917df	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-13 07:08:46.676	2026-06-13 07:08:46.676	2
17cbc851-58b4-4bf5-857d-99c21485b4b7	e7f469e2-5560-4a77-989a-81c3263aca0b	d0502a95-10c4-4576-a235-0b43a92195d3	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-13 07:08:46.677	2026-06-13 07:08:46.677	3
\.


--
-- Data for Name: ExpenseParticipant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ExpenseParticipant" (id, "expenseId", "userId") FROM stdin;
8cd84bf8-df72-4330-9fed-44a4a6afaaae	74248eac-e29f-4554-89c1-b3a491967cf7	63bb1ed9-432c-4638-bad3-50196226451c
c03e52a9-e2c1-48f1-8fdd-367dc4ee24b4	74248eac-e29f-4554-89c1-b3a491967cf7	fa102463-a816-4a12-945d-cb3d479c694e
020ea03e-9f43-4ce9-9a50-64a041a8d4bd	74248eac-e29f-4554-89c1-b3a491967cf7	9f2ba893-8b53-408d-9cf8-34af77aa7d1e
41f23e19-8cdd-432e-bf79-ed64ec3a08f4	74248eac-e29f-4554-89c1-b3a491967cf7	d83a4655-e4b7-4412-acac-fd73f17554d6
50203b31-f8d2-4208-8b36-47ef5d501a92	74248eac-e29f-4554-89c1-b3a491967cf7	0114313b-35d5-4106-a698-4f0d59c178e5
91fe9fd8-793a-4705-a2f6-fac99f900e92	d3f1ea5d-2a34-48f0-abbe-1f3c23a9f83c	63bb1ed9-432c-4638-bad3-50196226451c
1bd97656-2711-47cc-a31d-a7705daeaf9d	d3f1ea5d-2a34-48f0-abbe-1f3c23a9f83c	d83a4655-e4b7-4412-acac-fd73f17554d6
\.


--
-- Data for Name: PlacePhoto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlacePhoto" (id, "placeId", url, caption, "createdAt") FROM stdin;
\.


--
-- Data for Name: PlannerActivity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlannerActivity" (id, "tripId", name, emoji, location, description, "durationMins", cost, category, "mapsUrl", color, "createdAt", url) FROM stdin;
86792acf-021a-408f-a2a5-a3d3be9e996d	b389876f-9a01-4dda-b3a5-6b673a789468	Ravenna Gorge	🏞️	Hinterzarten	הגיא היפה ביותר ביער | הליכה ~8.8 ק"מ | גשרי עץ + מפלים	210	חינם	forest	https://maps.google.com/?q=Ravenna+Gorge+Hinterzarten+Germany	green	2026-06-14 14:01:38.59	\N
5e7031a7-372f-446a-99b1-0ad091b523a0	b389876f-9a01-4dda-b3a5-6b673a789468	Feldberg – פסגה + גונדולה	🏔️	20 דק' מ-Hinterzarten	הנקודה הגבוהה ביותר ביער (1,493מ') | נוף לאלפים	150	~€15	forest	https://maps.google.com/?q=Feldberg+Black+Forest+Germany	green	2026-06-14 14:01:38.59	\N
ebf72fd1-dbd2-4390-8203-82593be3d422	b389876f-9a01-4dda-b3a5-6b673a789468	Belchen – פנורמה 360°	⛰️	35 דק' מ-Hinterzarten	גונדולה + הליכה קצרה | נוף הכי יפה ביער	150	~€14	forest	https://maps.google.com/?q=Belchen+Black+Forest+Germany	green	2026-06-14 14:01:38.59	\N
627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	אגם Schluchsee	🌊	15 דק' מ-Hinterzarten	האגם הגדול ביותר ביער | שלווה, סירות, הליכה	120	חינם / €12	forest	https://maps.google.com/?q=Schluchsee+Germany	green	2026-06-14 14:01:38.59	\N
babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	אגם Titisee	⛵	10 דק' מ-Hinterzarten	הגלציאלי הציורי ביותר | טיול 90 דק' + סירות	150	חינם / €12	forest	https://maps.google.com/?q=Titisee+Germany	green	2026-06-14 14:01:38.59	\N
41e4ce1f-02cf-4d3e-a480-cb15071cb605	b389876f-9a01-4dda-b3a5-6b673a789468	מגלשת Hasenhorn	🛷	Todtnau	2,900 מ' מגלשת קיץ + כיסא מעופף | נוף מרהיב	120	~€12	forest	https://maps.google.com/?q=Hasenhorn+Coaster+Todtnau+Germany	green	2026-06-14 14:01:38.59	\N
db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	b389876f-9a01-4dda-b3a5-6b673a789468	מפלי Triberg + שעון קוקייה	💧	35 דק' מ-Hinterzarten	163 מ' / 7 מפלים | הגדולים בגרמניה	150	€5	forest	https://maps.google.com/?q=Triberg+Waterfalls+Germany	green	2026-06-14 14:01:38.59	\N
c9f0b379-321a-463f-a9df-72a07229e702	b389876f-9a01-4dda-b3a5-6b673a789468	Caracalla Therme Baden-Baden	♨️	45 דק'	מרחצאות תרמיים רומאיים | ספא מושלם	180	€25–30	forest	https://maps.google.com/?q=Caracalla+Therme+Baden-Baden+Germany	green	2026-06-14 14:01:38.59	\N
c58b2b1b-722f-4aaf-8e7c-c8b19f5ca877	b389876f-9a01-4dda-b3a5-6b673a789468	Freiburg im Breisgau	🏙️	35 דק'	קתדרלה + שוק + תעלות רחוב | עיר יפה	240	חינם	forest	https://maps.google.com/?q=Freiburg+im+Breisgau+Germany	green	2026-06-14 14:01:38.59	\N
e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	Sankt Blasien – כיפה ענקית	⛪	30 דק'	קתדרלה בסגנון פנתיאון רומאי	90	חינם	forest	https://maps.google.com/?q=Sankt+Blasien+Cathedral+Germany	green	2026-06-14 14:01:38.59	\N
401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	Mehliskopf Alpine Coaster	🎿	50 דק'	מגלשת אלפינה קצרה ומהנה	90	€4/רידה	forest	https://maps.google.com/?q=Mehliskopf+Alpine+Coaster+Germany	green	2026-06-14 14:01:38.59	\N
9d2e6dee-efad-47fa-ac93-fc857bc056f9	b389876f-9a01-4dda-b3a5-6b673a789468	Lindau – אי על הבודנזה	🏝️	~1.5 שעות נסיעה	אי קסום | נמל ציורי | נוף לאלפים	180	חינם	travel	https://maps.google.com/?q=Lindau+Bodensee+Germany	yellow	2026-06-14 14:01:38.59	\N
c65402df-2ae0-4e69-a3b0-4097638ac705	b389876f-9a01-4dda-b3a5-6b673a789468	טירת Neuschwanstein	🏰	~2 שעות נסיעה	טירת דיסני המקורית | הזמינו כרטיסים מראש!	240	€13	travel	https://maps.google.com/?q=Neuschwanstein+Castle+Germany	yellow	2026-06-14 14:01:38.59	\N
a04ad0ab-1572-4ca1-9765-b336bb93b065	b389876f-9a01-4dda-b3a5-6b673a789468	אגם Starnberg	🌊	30 דק' מ-מינכן	ציורי | מקום מותו של לודוויג ה-II	120	חינם	travel	https://maps.google.com/?q=Starnberger+See+Germany	yellow	2026-06-14 14:01:38.59	\N
9a2137df-d9a2-48a6-80d7-a2b2bee54437	b389876f-9a01-4dda-b3a5-6b673a789468	Marienplatz + Glockenspiel	🔔	מרכז מינכן	לב מינכן | Glockenspiel ב-11:00	90	חינם	munich	https://maps.google.com/?q=Marienplatz+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	b389876f-9a01-4dda-b3a5-6b673a789468	BMW Welt + Museum	🚗	U3 Olympiazentrum	מוזיאון מרשים בחינם | ליד האצטדיון האולימפי	150	חינם	munich	https://maps.google.com/?q=BMW+Welt+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
f5975328-6c65-4743-baaf-2226259f064c	b389876f-9a01-4dda-b3a5-6b673a789468	Deutsches Museum	🏛️	ליד נהר Isar	הגדול בעולם למדע וטכנולוגיה | מטוסים, רכבות, חלל	180	€14	munich	https://maps.google.com/?q=Deutsches+Museum+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
8c1b52ad-ddce-4be3-9ab8-79defe5eabd9	b389876f-9a01-4dda-b3a5-6b673a789468	English Garden + Eisbachwelle	🌳	מינכן	פארק ענק + גלישת גלים בלב העיר	120	חינם	munich	https://maps.google.com/?q=English+Garden+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
74242d01-2ac7-4563-b476-b32be671b660	b389876f-9a01-4dda-b3a5-6b673a789468	חדר בריחה – Exit the Room	🔐	מרכז מינכן	60 דק' לשחק + 15 דק' הכנה | ל-5–6 שחקנים	75	~€25	munich	https://maps.google.com/?q=Exit+the+Room+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
53f3dfd6-c3a5-4e06-ba1e-7e913b93fa70	b389876f-9a01-4dda-b3a5-6b673a789468	Paulaner Brewery Tour	🏭	מינכן	סיור מבשלה + טעימות בירה | הזמינו מראש	120	~€25	munich	https://maps.google.com/?q=Paulaner+Brauerei+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
ae99e942-7e2e-427d-b423-ab6cb6e2d709	b389876f-9a01-4dda-b3a5-6b673a789468	Olympiapark Munich	🏟️	מינכן צפון	אצטדיון 1972 + מגדל תצפית | ליד BMW Welt	90	חינם / €9	munich	https://maps.google.com/?q=Olympiapark+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
b04d899f-1cb7-4a2f-a261-5b5af09c4891	b389876f-9a01-4dda-b3a5-6b673a789468	משחק באיירן מינכן	⚽	Allianz Arena	בדקו לוח 26/27 | fcbayern.com	180	€40–100	munich	https://maps.google.com/?q=Allianz+Arena+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
5c08bb58-4a5f-429d-872e-8d88fa6ebe54	b389876f-9a01-4dda-b3a5-6b673a789468	F1 Simulator	🏎️	Racing Unleashed | Motorworld Munich	סימולטור מקצועי | הזמינו מראש!	90	~€60	munich	https://maps.app.goo.gl/FMSy4Hr2V8muTubF7	blue	2026-06-14 14:01:38.59	https://www.racing-unleashed.com/lounges/munich
523986c6-61c8-45f4-a57d-b56106035714	b389876f-9a01-4dda-b3a5-6b673a789468	TeamSport E-Karting Kart Palast	🏁	Bergkirchen-Feldgeding	קארטינג מהיר | ~20 דק' מהמרכז	90	~€30	munich	https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8	blue	2026-06-14 14:01:38.59	\N
37a8b454-91f7-44fc-9ef4-b1b6819bcdbb	b389876f-9a01-4dda-b3a5-6b673a789468	Viktualienmarkt – שוק	🛒	מרכז מינכן	שוק איכרים | ארוחת בוקר / צהריים מעולה	60	חינם	munich	https://maps.google.com/?q=Viktualienmarkt+Munich+Germany	blue	2026-06-14 14:01:38.59	\N
45a1549c-2968-440a-beec-cab47819f4e0	b389876f-9a01-4dda-b3a5-6b673a789468	Hofbräuhaus	🍺	מרכז מינכן	האייקון של מינכן | חובה לפחות פעם אחת	90	€25–35	food	https://maps.google.com/?q=Hofbrauhaus+Munich+Germany	orange	2026-06-14 14:01:38.59	\N
0f12fb3b-4348-4072-955c-ce31ad351117	b389876f-9a01-4dda-b3a5-6b673a789468	Augustiner Bräustuben	🌾	מינכן	הבירה הטובה ביותר לפי מקומיים	90	€30–40	food	https://maps.google.com/?q=Augustiner+Braustuben+Munich+Germany	orange	2026-06-14 14:01:38.59	\N
4feba9f3-969d-40ac-88c2-30419fd86d21	b389876f-9a01-4dda-b3a5-6b673a789468	Zum Franziskaner	🥩	מינכן	מסעדה בוורסטית מ-1363! | שניצל + כנפליים	90	€35–45	food	https://maps.google.com/?q=Zum+Franziskaner+Munich+Germany	orange	2026-06-14 14:01:38.59	\N
b2c6d1a5-1627-44e8-b263-0c06b62ef9e7	b389876f-9a01-4dda-b3a5-6b673a789468	Tantris – פינה-דיינינג	⭐	מינכן	ארוחת פרידה מושקעת | הזמינו 2+ חודשים מראש!	150	€80–120	food	https://maps.google.com/?q=Tantris+Munich+Germany	orange	2026-06-14 14:01:38.59	\N
bd17e255-c24e-4cae-a92b-db36ad181ea7	b389876f-9a01-4dda-b3a5-6b673a789468	Landgasthof Hirschen	🦌	Hinterzarten	ארוחת ערב מסורתית ביער | ציד, פטריות, שחור-יער	90	€30–40	food	https://maps.google.com/?q=Landgasthof+Hirschen+Hinterzarten	orange	2026-06-14 14:01:38.59	\N
ff5edc32-351d-4202-9503-64930ec1298a	b389876f-9a01-4dda-b3a5-6b673a789468	מסעדה על שפת Titisee	🌅	Titisee	ארוחה עם נוף לאגם ולהרים	75	€30–40	food	https://maps.google.com/?q=Restaurant+Titisee+Germany	orange	2026-06-14 14:01:38.59	\N
ad5161df-9521-454a-ad8c-2466484c18aa	b389876f-9a01-4dda-b3a5-6b673a789468	Europa Park	🎢	Rust, 30 דק'	פארק שעשועים מהגדולים באירופה | 100+ אטרקציות	540	€76	special	https://maps.google.com/?q=Europa+Park+Rust+Germany	red	2026-06-14 14:01:38.59	\N
fd1177b5-0ef6-4263-903b-11fea4fc0f6f	b389876f-9a01-4dda-b3a5-6b673a789468	Rhine Falls – Schaffhausen	💧	Schaffhausen, שווייץ, ~1.5 שעות	המפל הגדול ביותר באירופה — רוחב 150 מ' וגובה 23 מ'. אפשר לשכור סירה קטנה ולהגיע לגלעין הסלע שבמרכז המפל — חוויה מדהימה! מגיעים מ-Neuhausen am Rheinfall, יש חניה בתשלום. הכי יפה בשעות הבוקר המוקדמות לפני שיש המונים.	150	~€10	travel	https://maps.google.com/?q=Rhine+Falls+Schaffhausen+Switzerland	yellow	2026-06-18 10:24:43.341	\N
90f9eaec-c536-450c-aeda-e9c97187e4d7	b389876f-9a01-4dda-b3a5-6b673a789468	Rulantica Waterpark	🌊	Rust, 30 דק'	פארק המים הגדול ביותר בגרמניה שנפתח ב-2019, בבעלות Europa-Park. 17 מגלשות מי מרהיבות, מתחם גלים ענק, מגלשת רוקט-מי בגובה 4 קומות ואזור ילדים. מומלץ לרכוש כרטיסים משולבים עם Europa-Park ולהגיע מיד עם הפתיחה ב-9:00 — הפארק מתמלא מהר בקיץ!	360	€40–50	special	https://maps.google.com/?q=Rulantica+Waterpark+Rust+Germany	red	2026-06-18 10:24:43.341	\N
65a63b16-056a-457b-9cc4-5c2769cb5e70	b389876f-9a01-4dda-b3a5-6b673a789468	Allianz Arena Tour	🏟️	München, Fröttmaning	סיור מודרך במגרש הביתי של FC Bayern Munich — אחד האצטדיונים המרשימים בעולם. הסיור כולל גישה לטריבונה, חדרי ההלבשה, מנהרת השחקנים וה-VIP לאון. ניתן לשלב עם FC Bayern Museum הנמצא במקום. הזמינו כרטיסי סיור מראש באתר allianz-arena.com.	90	€19	munich	https://maps.google.com/?q=Allianz+Arena+Munich+Germany	blue	2026-06-18 10:24:43.341	https://allianz-arena.com
c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	Casino Baden-Baden	🎰	Baden-Baden, 45 דק'	אחד הקזינואים היוקרתיים ביותר בעולם — מבנה היסטורי מ-1824 עם עיצוב בארוקי מפואר. מקום הכינוס האהוב על מלכים ונסיכים באירופה. כניסה דורשת תעודת זהות ולבוש הולם (ז'כ חולצה, נשים שמלה/מכנסיים אלגנטיים). שעות: 14:00–02:00 בשבועות, 14:00–03:00 בסופי שבוע.	150	כניסה €5 + ₪ כיס	forest	https://maps.google.com/?q=Casino+Baden-Baden+Germany	green	2026-06-18 16:41:08.385	https://casino-baden-baden.de
d00f1664-9b94-4e47-b2dd-f17cfa3dfa36	b389876f-9a01-4dda-b3a5-6b673a789468	Casino Munich – Spielbank	🎰	München, Lehel	קזינו ממלכתי של מינכן, נמצא בלב העיר ליד גן ה-English Garden. מגוון שולחנות רולטה, בלאקג'ק ומכונות. הכניסה חינמית ולבוש מינימלי נדרש (לא ג'ינס קרועים). ניתן לקחת הפסקה לארוחת ערב במסעדה שבתוך הקזינו עם נוף לנהר Isar.	150	כניסה חינם + ₪ כיס	munich	https://maps.google.com/?q=Spielbank+Munich+Germany	blue	2026-06-18 16:41:08.385	https://spielbank-muenchen.de
0e01da25-664b-4dd3-9fbb-1c1c93043e5a	b389876f-9a01-4dda-b3a5-6b673a789468	Treetop Walk – Baumwipfelpfad Schwarzwald	🌳	Bad Wildbad, ~1.5 שעות מ-Hinterzarten	מסלול מרהיב בצמרות העצים של יער שחור — 1,250 מ' בגובה עד 20 מ' מעל הקרקע, עם גשרים מתנדנדים ופלטפורמות תצפית לאורך הדרך. השיא הוא מגדל תצפית ייחודי בגובה 40 מ' עם נוף פנורמי לכל הסביבה. מסלול קל ומתאים לכולם. מומלץ להגיע בוקר מוקדם לפני ההמונים.	120	~€12	forest	https://maps.app.goo.gl/KSgsYVu8WGmnMKrD8	green	2026-06-18 18:14:38.354	https://treetop-walks.com/schwarzwald/en/
8993e7ea-6180-4f78-9e66-ff9869c802d9	b389876f-9a01-4dda-b3a5-6b673a789468	Black Forest Burger	🍔	Waldshut-Tiengen, ~45 דק' מ-Hinterzarten	מסעדת המבורגר פרימיום בלב יער שחור, ידועה בהמבורגרים יצירתיים עם רכיבים מקומיים. בצק טרי, בשר איכותי ורטבים ביתיים — שילוב מושלם לאחר יום של הליכות ביער. מומלץ לבדוק שעות פתיחה מראש.	75	€15–25	food	https://share.google/zawQ36BfPg0aPJbkX	orange	2026-06-18 18:14:38.354	https://blackforestburger.de
fc288c48-ce26-4ce5-b165-751d7b935d62	b389876f-9a01-4dda-b3a5-6b673a789468	60 Secondi Pizza Napoletana	🍕	Occamstr. 11, Schwabing, מינכן	פיצה נאפוליטנית אמיתית — הבצק מותסס 48 שעות, התנור מגיע ל-450°C ואופה את הפיצה תוך 60 שניות בדיוק. אחת הפיצות הטובות במינכן, עם שילובי טופינג קלאסיים ועונתיים. ממוקם בשכונת Schwabing האופנתית, קרוב ל-English Garden. הגיעו מוקדם — לעיתים קרובות יש תור.	75	€14–20	food	https://share.google/2O8Yo6hnI0bMxhdpq	orange	2026-06-18 18:14:38.354	\N
678873d4-f120-48dc-87db-59ca5b1b80a7	b389876f-9a01-4dda-b3a5-6b673a789468	CA-BA-LU Bar-Restaurant	🍹	Thierschplatz 5, Lehel, מינכן	ברסטורן אמריקאי אינטימי ומשפחתי בשכונת Lehel היוקרתית של מינכן. המבורגרים יצירתיים, קוקטיילים מיוחדים ואווירה רגועה ונעימה — מושלם לערב כיפי עם חברים. המקום קטן ומתמלא מהר, כדאי להזמין שולחן מראש.	90	€20–35	food	https://share.google/vC3CfxJgrPLHXsBdT	orange	2026-06-18 18:14:38.354	\N
3755b71a-39ab-407e-9d00-5de8867a8ce3	b389876f-9a01-4dda-b3a5-6b673a789468	שטרסבורג – קתדרלה + פטיט פרנס	🇫🇷	שטרסבורג, אלזס – 45 דק' מפרייבורג	עיר אלזסית מרהיבה על גבול גרמניה-צרפת. קתדרלת Notre-Dame הגותית מ-1439 – אחת הגבוהות שנבנו אי פעם. שכונת "פטיט פרנס" – מבוך של תעלות ובתים מחוץ-לעיר מהמאה ה-16. בוקר בשוק Marché des Halles, קירש אלזסי בצהריים. הגיעו לפני 9:00 לפני שמתמלא.	300	חינם + אוכל	travel	https://maps.google.com/?q=Strasbourg+Cathedral+France	blue	2026-06-22 10:36:03.765	https://www.strasbourg.eu/
cb64ba7d-1367-45b3-86e2-ba340b0d7528	b389876f-9a01-4dda-b3a5-6b673a789468	קולמאר – "ונציה הקטנה" של אלזס	🏡	קולמאר, אלזס – 1:15 שעות מפרייבורג	הכפר הצבעוני ביותר של אלזס, נקרא La Petite Venise. בתים בגווני פסטל מהמאה ה-16, תעלות קסומות ופרחים בכל פינה. טעימות יין Gewurztraminer מקומי ב-Winstub (בר יין מסורתי). פחות עמוס משטרסבורג, יותר אינטימי. הוסיפו כמה שעות ל-Strasbourg בדרך חזרה.	210	חינם + אוכל	travel	https://maps.google.com/?q=Colmar+Alsace+France	blue	2026-06-22 10:36:03.765	\N
fc50653c-9b9b-498a-8d0f-d201ffd477c1	b389876f-9a01-4dda-b3a5-6b673a789468	קייסרסברג – כפר אלזסי ממוצר	🍷	Kaysersberg, אלזס – 20 דק' מ-Colmar	אחד הכפרים היפים ביותר של צרפת לפי Le Journal du Dimanche. חורבות טירת מלאכי הממוגנת על הגבעה, גשר ימי-ביניימי כפול, ייננות קטנות ואחרות שנותנות טעימות חינם. Albert Schweitzer נולד כאן – יש מוזיאון. אוקטובר – עונת הבציר! הסביבה מלאה ביקבים פעילים.	150	חינם + טעימות	travel	https://maps.google.com/?q=Kaysersberg+Alsace+France	blue	2026-06-22 10:36:03.765	\N
b1858309-9bd6-4e6a-9e40-43b3e21bf3fb	b389876f-9a01-4dda-b3a5-6b673a789468	קונסטנץ + אי מיינאו	🌸	Konstanz, Bodensee – 1:30 שעות מ-Hinterzarten	עיר מימי הביניים יפה על שפת Bodensee (ים פנימי גרמני). אי Mainau – "אי הפרחים" של נסיכי השוודסקים, 45 הקטאר של גני פרחים, ורדים ודקלים עם ארמון בארוקי. גשר קצר לאי. אוקטובר – ורדים אחרונים ודהליות. שלבו עם טיול סירה קצר על האגם.	240	€19 אי מיינאו	travel	https://maps.google.com/?q=Mainau+Island+Lake+Constance	blue	2026-06-22 10:36:03.765	\N
e5ffb65a-444d-41a3-8fb2-bcf437b7f704	b389876f-9a01-4dda-b3a5-6b673a789468	ויסקירכה – כנסיית מורשת UNESCO	⛪	Steingaden – בדרך ל-Neuschwanstein	אחת הכנסיות הבארוקיות-רוקוקו המרהיבות בעולם, אתר מורשת UNESCO מ-1983. הפנים מצופה זהב עם ציורי תקרה מרשימים מ-1754. בנייה חיצונית פשוטה לחלוטין – הניגוד בפתיחת הדלת מהמם. בדרך מ-Neuschwanstein – אין טעם לדלג. כניסה חינמית, תרומה מוערכת.	60	חינם	travel	https://maps.google.com/?q=Wieskirche+Steingaden+Germany	blue	2026-06-22 10:36:03.765	\N
05530528-efca-4c8b-a31e-fd121308fa67	b389876f-9a01-4dda-b3a5-6b673a789468	פיסן – עיר עתיקה ציורית	🏙️	Füssen – ממש ליד Neuschwanstein	אם כבר ב-Neuschwanstein אזור – חובה לעצור בעיר פיסן. גטה העתיקה הצבעונית, Hohes Schloss (טירה של Bishops) עם מוזיאון בפנים, ונהר Lech שזורם דרכה. ארוחת צהריים אמיתית כאן – הרבה יותר אותנטי מהמסעדות הדחוסות בגבעת Neuschwanstein.	120	חינם + אוכל	travel	https://maps.google.com/?q=Fuessen+Old+Town+Bavaria	blue	2026-06-22 10:36:03.765	\N
b33ae8a5-41d4-4c7a-ad77-c86fb926100f	b389876f-9a01-4dda-b3a5-6b673a789468	אאוגסבורג – ריינבות מוזיאון + Fuggerei	🏛️	Augsburg – 1 שעה ממינכן	הסצנה היהודית-רנסנסית הגדולה בגרמניה. Fuggerei (1516) – שכונת העניים הוותיקה בעולם, עדיין פעילה (שכ"ד €1 לשנה + תפילה!). קתדרלה מ-1065 עם ויטראז'ים מ-1065 – הישנים ביותר בעולם. נחמד לשלב עם מינכן ביום אחד.	180	€4 Fuggerei	travel	https://maps.google.com/?q=Augsburg+Germany	blue	2026-06-22 10:36:03.765	\N
d8e2f4dc-7428-4e96-85b7-8fb6f9b66e6d	b389876f-9a01-4dda-b3a5-6b673a789468	מפלי Allerheiligen + חורבות מנזר	🌊	Oppenau – ~1 שעה מ-Hinterzarten	מקום סודי ביער שחור שרוב התיירים פוספסים – 7 מפלים קסומים לאורך שביל ~3 ק"מ ולצדם חורבות מנזר Premonstratensian מהמאה ה-12. ירידת מדרגות אבן קדומות בין סלעי שרף עם שורשים חושפניים. חניה קטנה בכניסה (€3). כמעט תמיד שקט – גם בסוף שבוע.	150	€3	forest	https://maps.google.com/?q=Allerheiligen+Waterfalls+Germany	green	2026-06-22 10:36:03.765	\N
b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	מוזיאון הכפר הפתוח Vogtsbauernhof	🏚️	Gutach – 45 דק' מ-Hinterzarten	המוזיאון בשטח הפתוח הגדול ביותר של יער שחור – חוות מסורתיות מהמאות ה-16–19 הועתקו לכאן ממקורן. תצוגות חיות: נגרות, נפחות, אפייה בתנור עץ, ייצור שעוני קוקייה. פועלים לבושים בתלבושות מסורתיות. מושלם להבנת תרבות יער שחור האמיתית. 9:00–18:00.	180	€12	forest	https://maps.google.com/?q=Vogtsbauernhof+Open+Air+Museum+Gutach	green	2026-06-22 10:36:03.765	\N
b19eee5b-7704-4f19-b8fe-30f8f198f77f	b389876f-9a01-4dda-b3a5-6b673a789468	Hornisgrinde – פסגת יער שחור הצפוני	⛰️	Hornisgrinde, ~1:30 שעות מ-Hinterzarten	הנקודה הגבוהה של יער שחור הצפוני (1,163 מ'). בימים בהירים – נוף לאלפים ולאלזס, מעל שכבת הערפל שמכסה את עמק הריין. נסיעה ברכב עד קרוב לפסגה (כביש שמורה) + הליכה 20 דק'. מגדל תצפית קטן בחינם. לשלב עם BadWildbad ו-Allerheiligen.	120	חינם	forest	https://maps.google.com/?q=Hornisgrinde+Black+Forest+Germany	green	2026-06-22 10:36:03.765	\N
c5d56c05-7306-444c-84c5-af3e5171c0f8	b389876f-9a01-4dda-b3a5-6b673a789468	Schauinsland – רכבל + שביל ירידה	🚡	20 דק' מפרייבורג	הרכבל הארוך ביותר של יער שחור (3.6 ק"מ) מוביל ל-1,284 מ'. בפסגה: מגדל תצפית 360°, שבילי הליכה קלים ומסעדה בנוף. ניתן לרדת ברגל בשביל מסומן (~2 שעות). מצוין לשלב עם ביקור בפרייבורג באותו יום. פתוח כל ימות השנה.	180	€14 הלוך-חזור	forest	https://maps.google.com/?q=Schauinsland+Cable+Car+Freiburg	green	2026-06-22 10:36:03.765	\N
2be2327f-978e-4342-8683-a8bcf5869f5b	b389876f-9a01-4dda-b3a5-6b673a789468	גיא Wutachschlucht – הגרנד קניון של גרמניה	🏞️	Lenzkirch – 30 דק' מ-Hinterzarten	שמורת טבע מרשימה הנקראת "הגרנד קניון של שחור יער" – גיא עמוק שנוצר בעקבות שינוי כיוון נהר Wutach לפני 10,000 שנים. שביל הגיא הקלאסי: ~13 ק"מ עם מפלי מים, גשרים ועצים ענקיים. גרסה קצרה: 4 ק"מ מ-Schattenmühle. נסיעת חזרה כדאי לתאם מראש.	300	חינם	forest	https://maps.google.com/?q=Wutach+Gorge+Germany	green	2026-06-22 10:36:03.765	\N
78d7f1a3-0050-4538-8d8a-8a8ff49f8e21	b389876f-9a01-4dda-b3a5-6b673a789468	Baden-Baden Trinkhalle + Lichtenthaler Allee	🌿	Baden-Baden – 45 דק' מ-Hinterzarten	הפרומנדה המפורסמת של "קרלסבד של גרמניה" – טיילת Lichtenthaler Allee (4 ק"מ) לאורך נהר Oos עם פסלים ואיל צ'ייקובסקי כתב כאן. Trinkhalle – מסדרון מפואר מ-1842 עם ציורי קיר של אגדות שחור יער, שם מגישים מי ריפוי (חינם). כניסה לעיר בחינם.	120	חינם	forest	https://maps.google.com/?q=Trinkhalle+Baden-Baden+Germany	green	2026-06-22 10:36:03.765	\N
c3fee9e5-1d6d-4b04-98d0-587b6dc9b7fe	b389876f-9a01-4dda-b3a5-6b673a789468	ארמון נימפנבורג + גנים	🏰	מינכן מערב – 15 דק' מהמרכז	הארמון הגדול ביותר של בוואריה – 600 מ' של חזית בארוקית עם גנים צרפתיים עצומים (בחינם). פנים: גלריית היפהפיות של לודוויג I – 36 דיוקנות נשים מכל השכבות שסקרנו את המלך. ביתן Amalienburg בגנים – מופת ה-Rococo הגרמני. מגיעים בטראם 17 ישירות מהמרכז.	180	€15	munich	https://maps.google.com/?q=Nymphenburg+Palace+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
c8c5fbe4-8bdb-4e0f-a262-58b78d09916c	b389876f-9a01-4dda-b3a5-6b673a789468	רזידנץ מינכן – ארמון הוויטלסבאכים	👑	מרכז מינכן, Odeonsplatz	הארמון האורבני הגדול ביותר בגרמניה – 130 חדרים! Antiquarium: אולם הרנסנס הגדול ביותר מצפון לאלפים, מהמאה ה-16. Schatzkammer: כתרי מלכים, דיאדמות ותכשיטי מלכות מדהימים. Hofkapelle: קפלה מלכותית זעירה ומושלמת. כרטיס משולב עם Cuvilliés Theatre (הקטן-מושלם) – שווה.	150	€9 / €18 משולב	munich	https://maps.google.com/?q=Munich+Residenz+Germany	blue	2026-06-22 10:36:03.765	\N
07c4ea9d-0b30-45e4-a1c0-6570077a26e8	b389876f-9a01-4dda-b3a5-6b673a789468	Alte Pinakothek – מיטב ציור אירופה	🎨	Kunstareal, Maxvorstadt מינכן	אחד ממוזיאוני האמנות הגדולים בעולם – אוסף מהמאות 14–18. רמברנדט, רובנס (28 יצירות!), ואן אייק, רפאל, בוטיצ'לי, דירר. הבניין עצמו ניאו-רנסנס מרשים. ימי שלישי: כניסה €1 (!!). מומלץ לשלב עם טייל ב-Maxvorstadt ובית הקפה Pinakothek.	150	€7 / €1 בימי ג'	munich	https://maps.google.com/?q=Alte+Pinakothek+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
f399d00c-ea31-4adc-8143-c338c181b129	b389876f-9a01-4dda-b3a5-6b673a789468	KZ Dachau – אנדרטה ומוזיאון	🕯️	Dachau – 20 דק' ממינכן ברכבת S2	אתר ההנצחה של מחנה הריכוז הנאצי הראשון (1933–1945). המוזיאון מוביל דרך ההיסטוריה השלמה, צריפי מגורים שוחזרו ומגדלי שמירה מקוריים. כניסה חינמית. מגיעים: S2 לתחנת Dachau + אוטובוס 726. קחו 3–4 שעות, ואל תדלגו – זו חוויה שמשנה.	210	חינם	munich	https://maps.google.com/?q=Dachau+Concentration+Camp+Memorial	gray	2026-06-22 10:36:03.765	\N
700d20d2-5e4d-40dd-b71d-58dca2c994de	b389876f-9a01-4dda-b3a5-6b673a789468	Olympiaturm – מגדל תצפית 291 מ'	🗼	Olympiapark, מינכן	מגדל הטלוויזיה של מינכן – פלטפורמת תצפית ב-190 מ' עם נוף מרהיב לאלפים ביום בהיר. מסעדה מסתובבת בפסגה (סיבוב מלא ב-53 דק'). שלבו עם ביקור ב-BMW Welt ו-Olympiapark הסמוכים. הטיפוס במעלית בשניות – צאו בגדול עם 5 נקודות בפעם אחת.	90	€11	munich	https://maps.google.com/?q=Olympiaturm+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
b4afe23a-c53c-471e-a3df-6ed9ab42f537	b389876f-9a01-4dda-b3a5-6b673a789468	Bavaria פסל + Ruhmeshalle	🗿	Theresienhöhe, מינכן – ליד שטח ה-Oktoberfest	פסל ברונזה ענקי (18 מ') של בוואריה – ניתן לטפס לתוכו במדרגות פנימיות ולהציץ מעיניה על מינכן! Ruhmeshalle לצדו – אולמות קלאסיציסטיים עם פסלי גדולי בוואריה. הפסל נמצא בדיוק במקום שבו מוקם Oktoberfest. כניסה לפנים הפסל: €4 – לא לפספס.	60	€4	munich	https://maps.google.com/?q=Bavaria+Statue+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
76bb0eee-4ea3-4a58-93ac-6105f218def7	b389876f-9a01-4dda-b3a5-6b673a789468	Therme Erding – ספא המים הגדול בעולם	♨️	Erding – 40 דק' ממינכן	מתחם ספא תרמי שהוא הגדול בעולם – 29 בריכות מים, 27 מגלשות, מרכז גלים ענק, ג'קוזי חיצוני ואזור ספא "Therme Vital". יום כיף אמיתי שמשנה את הרגלים. אזהרה: כרטיס בסיסי לא כולל הכל – תבדקו מה רוצים מראש. מגיעים ב-9:00 עם פתיחה.	360	€30–50	munich	https://maps.google.com/?q=Therme+Erding+Germany	blue	2026-06-22 10:36:03.765	https://www.therme-erding.de/
f48d4323-8a11-4af4-86db-9ebdadc48655	b389876f-9a01-4dda-b3a5-6b673a789468	גלישה על Eisbachwelle – גל בלב מינכן	🏄	כניסה לגן האנגלי, Prinzregentenstrasse	גל עומד מלאכותי בנהר Eisbach – גולשי גלים מקצועיים מחכים בתור לגלוש על גל אחד לנצח! סוריאליסטי לראות גלישת גלים בלב עיר. ניתן לצפות בחינם כל שעות היום – גולשים מגיעים בכל מזג אוויר. 100 מ' מהכניסה לגן האנגלי. מדיה של אנשים עם מצלמות מגיעה תמיד.	45	חינם	munich	https://maps.google.com/?q=Eisbachwelle+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
6e7439a0-448a-4675-b6d5-888e9a852c82	b389876f-9a01-4dda-b3a5-6b673a789468	Schloss Schleissheim – ורסאי של מינכן	🏯	Schleissheim – 20 דק' ממינכן	קומפלקס של שלושה ארמונות בארוקיים, נקרא "ורסאי הבוורסטי". New Palace – מגדל אמנות עם אוסף ציורי Rubens ו-Titian. הגנים הגדולים עם תעלות ופסלים – כמעט אין תיירים לעומת Nymphenburg. קלאסיקה לנסיעת בוקר מינכן.	150	€8	munich	https://maps.google.com/?q=Schleissheim+Palace+Munich+Germany	blue	2026-06-22 10:36:03.765	\N
6cd981e3-f9a7-40e1-9674-791addeec7b6	b389876f-9a01-4dda-b3a5-6b673a789468	Augustiner Keller – ביירגארטן מ-1812	🍺	Arnulfstrasse 52, קרוב ל-HBF מינכן	הביירגארטן הגדול ביותר של מינכן – 5,000 מקומות בצל עצי ערמון ענקיים. בירת Augustiner Lagerbier ישירות מחבית עץ (Holzfass) – שונה לגמרי מהבקבוק. Brathendl (עוף צלוי) + ליטר בירה ~€25. אווירה מינכנאית אמיתית. פתוח גם בחורף במסעדה הפנימית הגדולה.	120	€25–35	food	https://maps.google.com/?q=Augustiner+Keller+Beer+Garden+Munich	amber	2026-06-22 10:36:03.765	\N
8e60fd47-28f2-496a-a51b-adb7c410c9a0	b389876f-9a01-4dda-b3a5-6b673a789468	Wirtshaus in der Au – בוורי אמיתי	🥟	Lilienstrasse 51, שכונת Au, מינכן	מסעדת בוורסט אהובה בשכונה אותנטית. מפורסמת ב-Käsespätzle (פסטה גרמנית עם גבינה – מנחמת מאוד) ו-Schäufele (כתף חזיר מפוארת). עיצוב חאן קלאסי, שירות מחייך. בסופי שבוע: ארוחת בוקר עם Weißwurst אותנטי. הזמינו שולחן בסוף שבוע.	90	€20–30	food	https://maps.google.com/?q=Wirtshaus+in+der+Au+Munich	amber	2026-06-22 10:36:03.765	\N
31d6221f-37e8-470f-8f83-97748f879e08	b389876f-9a01-4dda-b3a5-6b673a789468	Schneider Weisse Tap House	🍻	Tal 7, מרכז מינכן העתיק	בית הביאר של בירת החיטה הנחשבת ביותר בגרמניה – ממש בלב מינכן העתיקה. 7 בירות מהחבית כולל "Mein Aventinus" האגדית (8.2%, כהה וחזקה). מנות שמתאימות לבירה. קטן ואינטימי – הגיעו בין 14:00–17:00 לפני שמתמלא.	90	€20–35	food	https://maps.google.com/?q=Schneider+Weisse+Tap+House+Munich	amber	2026-06-22 10:36:03.765	\N
cf3187cf-305b-4856-9f90-954048f811d1	b389876f-9a01-4dda-b3a5-6b673a789468	Ratskeller מינכן – מרתף העיריה	🏛️	Marienplatz 8 (מתחת לעיריה)	מסעדה היסטורית מ-1874 בקמרונות הגותיים מתחת לבניין העיריה של מינכן. מנות בוורסטיות קלאסיות: Weißwurst, Schweinshaxe, Schnitzel. מחיר סביר לתיירים ביחס לאיכות ומיקום. האווירה ייחודית – כמו לאכול בתוך מצודה.	90	€25–40	food	https://maps.google.com/?q=Ratskeller+Munich+Germany	amber	2026-06-22 10:36:03.765	\N
3183ddbc-352b-438b-8c22-4249761c42ab	b389876f-9a01-4dda-b3a5-6b673a789468	Brenner Grill – איטלקי פרימיום	🥩	Maximilianstrasse 15, מינכן	מסעדת גריל איטלקית מרשימה על הרחוב היוקרתי ביותר של מינכן. Bistecca Fiorentina ענקית (T-Bone 1 ק"ג), פסטות ביתיות, Bar קוקטיילים מצוין. עיצוב תעשייתי-אלגנטי. מחיר גבוה אבל תמורה גבוהה – מסעדה לערב יוצא דופן.	120	€40–70	food	https://maps.google.com/?q=Brenner+Grill+Munich+Germany	amber	2026-06-22 10:36:03.765	\N
1c0e4d6d-6452-41bc-8896-1d166f049f85	b389876f-9a01-4dda-b3a5-6b673a789468	Schuhbeck's – שף הכוכבים של בוואריה	⭐	Platzl 4, מרכז מינכן	Alfons Schuhbeck – השף המפורסם ביותר של בוואריה ושף הנבחרת הגרמנית. מגוון מסעדות: Fine Dining, ביסטרו, בר. חנות תבלינים בחינם – חוויה בפני עצמה. מנות בוורסטיות-מחודשות עם טוויסטים בינלאומיים. לארוחה מושלמת.	120	€40–90	food	https://maps.google.com/?q=Schuhbecks+Orlando+Munich	amber	2026-06-22 10:36:03.765	\N
ae9ded01-0098-4cb9-bd0f-cc069dd37137	b389876f-9a01-4dda-b3a5-6b673a789468	Schwarzwaldstube – 3 כוכבי מישלן	⭐	Baiersbronn, Tonbach – 45 דק' מ-Hinterzarten	אחת מ-9 מסעדות גרמניה עם 3 כוכבי מישלן. שף Harald Wohlfahrt בנה שם עולמי 34 שנה. Nouvelle Cuisine עם מרכיבי יער שחור: ציד, פטריות בר, עשבים. הזמינו חודשיים+ מראש! תפריט ערב €215–280 לאדם – ארוחת חיים.	240	€215–280	food	https://maps.google.com/?q=Schwarzwaldstube+Restaurant+Baiersbronn	amber	2026-06-22 10:36:03.765	\N
bf90bf6a-9d84-4fde-b1ac-12f4ef03ce15	b389876f-9a01-4dda-b3a5-6b673a789468	Winstub אלזסי – ארוחה מסורתית בצרפת	🧀	שטרסבורג / קולמאר, אלזס	Winstub = בר-יין מסורתי אלזסי, דומה לאוסטריה. מנות: Choucroute garnie (כרוב כבוש עם 5 סוגי בשר), Tarte flambée (פיצה דקה עם שמנת וגבינה), Munster (גבינה ריחנית). יין: Riesling, Pinot Gris, Gewurztraminer. חפשו ב-Strasbourg: Winstub le Clou, Chez Yvonne.	90	€25–40	food	https://maps.google.com/?q=Winstub+Strasbourg+France	amber	2026-06-22 10:36:03.765	\N
42afe479-4951-46a7-9cd5-7258c1c290b0	b389876f-9a01-4dda-b3a5-6b673a789468	Brauereigasthof Rothaus – בירת היער	🍺	Grafenhausen-Rothaus – 50 דק' מ-Hinterzarten	המבשלה הממלכתית הגדולה ביותר של בדן-וורטמברג – מבשלת את Tannenzäpfle (הבירה הנמכרת ביותר בדרום גרמניה). אפשר לסייר במבשלה (+€5) ולאכול במסעדה המסורתית. בירה הטרייה ישירות מהמקור שונה לגמרי ממה שנמכר בחנויות.	120	€15–25	food	https://maps.google.com/?q=Brauerei+Rothaus+Germany	amber	2026-06-22 10:36:03.765	\N
3e2b92dd-5dec-45b2-b0e7-c86c4bb71405	b389876f-9a01-4dda-b3a5-6b673a789468	FC Bayern Museum	🏆	Allianz Arena, Fröttmaning	מוזיאון הקבוצה הגדולה של גרמניה – 5 קומות, 3,000+ גביעים ופריטים. חדר סגנון FIFA ענק, מאחורי הקלעים של ה-Bundesliga, סרטי ניצחון ותצוגות אינטראקטיביות. אפשר להיכנס ללבוש הז'רזי של שחקנים. משולב נהדר עם Allianz Arena Tour.	90	€12 / €28 משולב Arena	munich	https://maps.google.com/?q=FC+Bayern+Museum+Munich	blue	2026-06-22 10:36:03.765	https://fcbayern.com/en/club/museum
eb9900c8-d4b1-48b2-b708-7bc199a150c8	b389876f-9a01-4dda-b3a5-6b673a789468	אופרה / קונצרט – הופעה מינכנאית	🎭	מינכן – Nationaltheater / Gasteig	מינכן = בירת מוזיקה גרמנית. האופרה הממלכתית (Bayerische Staatsoper) – אחת מ-5 הגדולות בעולם. Gasteig / Isarphilharmonie – קונסרבטוריה מהממת. לבדוק לוחות ב-muenchenticket.de / staatsoper.de. כרטיסי Standing Room באופרה: €12 בלבד! חוויה בלתי נשכחת.	180	€12–80	munich	https://maps.google.com/?q=Bayerische+Staatsoper+Munich	blue	2026-06-22 10:36:03.765	https://www.muenchenticket.de/
d9fd02c9-b736-4b85-91d7-291e6280d2bc	b389876f-9a01-4dda-b3a5-6b673a789468	Traumatica Halloween – Europa Park	👻	Europa Park, Rust – 30 דק' מ-Hinterzarten	אירוע ה-Halloween הגדול ביותר בגרמניה! אוקטובר = Europa Park הופך למפחיד: 6 בתי רפאים, 3 מופעי תיאטרון, קוסמים ושדים בכל הפארק, תפאורה מרשימה. 19:00–23:30. כרטיסים נגמרים מוקדם – הזמינו חודש מראש! ניתן לשלב: ביקור פארק ביום + Traumatica בלילה.	300	€40 / €65 עם היום	special	https://maps.google.com/?q=Europa+Park+Rust+Germany	purple	2026-06-22 10:36:03.765	https://www.europapark.de/
0c6068cf-52d8-4933-9036-b55a8deb4aec	b389876f-9a01-4dda-b3a5-6b673a789468	Wine tasting – יקבי אלזס	🍷	Route des Vins d'Alsace, צרפת	כביש יין האלזסי – 170 ק"מ של יקבים, כפרים ציוריים וחורשות ענבים. אוקטובר = עונת הבציר הפעילה! מסלול מומלץ: Colmar → Riquewihr → Ribeauvillé → Kaysersberg. רוב היקבים נותנים טעימות חינם. Gewurztraminer, Riesling, Pinot Gris – יינות ייחודיים לאלזס.	300	חינם + קנייה	special	https://maps.google.com/?q=Route+des+Vins+Alsace+France	purple	2026-06-22 10:36:03.765	\N
8326f3d0-3a51-4f94-b5c9-a2e1601e2305	b389876f-9a01-4dda-b3a5-6b673a789468	Zero Latency Virtual Reality München Neufahrn	🥽	Neufahrn bei Freising	VR חופשי במרחב גדול | מתאים לקבוצה | להזמין מראש	90	~€35–50	munich	https://share.google/4XC1eIHWNf1tBZUqp	blue	2026-06-26 13:19:35.424	\N
81130cfa-cc64-49b8-bc6a-76fdde38833f	b389876f-9a01-4dda-b3a5-6b673a789468	BattleKart München-Finsing	🏎️	Finsing	קארטינג חשמלי עם משחקי AR מוקרנים על המסלול | להזמין מראש	90	~€25–35	munich	https://maps.app.goo.gl/zQG7zkYq69wH67ya9	blue	2026-06-26 13:15:49.245	https://www.battlekart.com/de/muenchen-finsing
\.


--
-- Data for Name: PlannerActivityFile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlannerActivityFile" (id, "activityId", filename, "originalName", "mimeType", size, "createdAt") FROM stdin;
\.


--
-- Data for Name: PlannerActivityVote; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlannerActivityVote" (id, "activityId", "tripId", "userId", vote, "createdAt", "updatedAt") FROM stdin;
f2814a48-bf2e-4294-b1d1-481834c95302	d00f1664-9b94-4e47-b2dd-f17cfa3dfa36	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 13:45:08.234	2026-06-18 14:21:16.782
3acdd318-e2d4-465f-bc24-5351cb73dfdc	c5d56c05-7306-444c-84c5-af3e5171c0f8	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:03:52.408	2026-06-22 08:03:52.408
31da55ba-8ef2-47ae-9443-04e5d5e69a43	b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:04:01.526	2026-06-22 08:04:01.526
a78416c5-51f8-4b43-b129-eab9a09ee92c	07c4ea9d-0b30-45e4-a1c0-6570077a26e8	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:05:30.891	2026-06-22 08:05:30.891
67e89919-d61d-40c3-8477-7f5e16820ed4	700d20d2-5e4d-40dd-b71d-58dca2c994de	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:06:00.684	2026-06-22 08:06:00.684
5444366e-098f-44b7-9da2-ccf510f5f88a	b4afe23a-c53c-471e-a3df-6ed9ab42f537	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:06:17.409	2026-06-22 08:06:17.409
9e98666c-1d8d-497a-b63b-271c841497b2	76bb0eee-4ea3-4a58-93ac-6105f218def7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	AGAINST	2026-06-22 08:06:32.73	2026-06-22 08:06:32.73
34a973c7-dc9f-4b01-9de6-936b4f1f97f3	f48d4323-8a11-4af4-86db-9ebdadc48655	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	AGAINST	2026-06-22 08:06:44.511	2026-06-22 08:06:44.511
d923ab41-2fc9-4941-8d8b-c5dea6ee094f	6e7439a0-448a-4675-b6d5-888e9a852c82	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:06:56.83	2026-06-22 08:06:56.83
93670c54-75db-4170-9093-4dae46ecd9bd	3e2b92dd-5dec-45b2-b0e7-c86c4bb71405	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:07:05.229	2026-06-22 08:07:05.229
985d35db-270b-4e19-a133-2c740ff03476	eb9900c8-d4b1-48b2-b708-7bc199a150c8	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:07:11.39	2026-06-22 08:07:11.39
e0e4424a-a6d8-464e-be0c-8ae09e1be1d6	3755b71a-39ab-407e-9d00-5de8867a8ce3	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:07:22.92	2026-06-22 08:07:22.92
a5882771-fc28-401c-8ecc-4b3d7ecb6075	cb64ba7d-1367-45b3-86e2-ba340b0d7528	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:07:30.99	2026-06-22 08:07:30.99
2f0bd75e-0d04-41d3-b682-7096788d4af1	c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 14:14:29.739	2026-06-18 14:14:29.739
24d17337-5ebe-43dc-aba6-e6fa07a753c7	5e7031a7-372f-446a-99b1-0ad091b523a0	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
f5825e59-e9af-4d33-9638-d68eabe5233a	a04ad0ab-1572-4ca1-9765-b336bb93b065	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
18a52b71-e930-4ccd-90b5-58fd86d4f445	86792acf-021a-408f-a2a5-a3d3be9e996d	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
0d097dc1-9cc6-4e0b-a539-b47f052781b5	ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
92f92486-5397-4201-9a3b-e892eaa68e9f	b04d899f-1cb7-4a2f-a261-5b5af09c4891	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
0384340e-9e16-47a2-ba2b-f8c347cef7bf	37a8b454-91f7-44fc-9ef4-b1b6819bcdbb	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
a0d60998-e992-4e88-a6a8-b2f2dcc76d39	627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
13119195-ed91-45ab-9ae6-6a4d11f72950	ebf72fd1-dbd2-4390-8203-82593be3d422	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
5bfb8458-5e83-4389-bc42-77fb2c1c558f	65a63b16-056a-457b-9cc4-5c2769cb5e70	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
d5926a00-7a22-44ab-a861-763846272a24	babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.946	2026-06-18 09:08:41.946
d11bc262-dae4-42c7-a734-32459c4e23a7	fd1177b5-0ef6-4263-903b-11fea4fc0f6f	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
6f7fcb90-f833-47e3-aa4c-4d7b798e7d1e	45a1549c-2968-440a-beec-cab47819f4e0	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
983d7057-1cc7-411a-81c5-00303c6943a9	c65402df-2ae0-4e69-a3b0-4097638ac705	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
540e92f7-dddb-4f75-a6de-034a1652cbcc	ae99e942-7e2e-427d-b423-ab6cb6e2d709	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-18 09:08:41.945	2026-06-18 09:08:41.945
1fa1681d-a828-4441-b475-00066d5af992	4feba9f3-969d-40ac-88c2-30419fd86d21	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
2ace4dbc-93a4-4dbe-ac8a-2449aa31e3d6	0f12fb3b-4348-4072-955c-ce31ad351117	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
0a632094-5115-429c-a338-259e2295ea28	b2c6d1a5-1627-44e8-b263-0c06b62ef9e7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
ed081ec7-40db-4e04-83f6-539875bb4374	f5975328-6c65-4743-baaf-2226259f064c	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-18 09:08:41.946	2026-06-18 09:08:41.946
ae4008e3-f76d-48c5-b665-960934755981	ff5edc32-351d-4202-9503-64930ec1298a	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
0dca916f-c451-4a38-a00b-dd0bf6407339	bd17e255-c24e-4cae-a92b-db36ad181ea7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
79885563-e131-4c90-b46e-db13df77f136	ad5161df-9521-454a-ad8c-2466484c18aa	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
30291537-6eb3-4bdd-85df-f723f613dff9	c9f0b379-321a-463f-a9df-72a07229e702	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
23376e6c-3c16-43d6-9f8e-c14e2994547b	c58b2b1b-722f-4aaf-8e7c-c8b19f5ca877	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
d8534d05-67c1-4a0c-ab68-2aea9b47ae61	e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
c1039766-1ab5-4017-9180-439a90ed120d	401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
86d5d4c5-4a22-4f00-8003-19094e7aed41	90f9eaec-c536-450c-aeda-e9c97187e4d7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
947ea5e8-4478-4065-97b7-70e29ec00ee6	db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
6d4ef39c-5763-42b6-b435-d4df7ce61e76	9a2137df-d9a2-48a6-80d7-a2b2bee54437	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
0e5bbf90-70be-4bb4-9e19-ce9403835b41	8c1b52ad-ddce-4be3-9ab8-79defe5eabd9	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
9a4eb8c7-4e6b-4a1e-b93e-a3d8ff68435c	53f3dfd6-c3a5-4e06-ba1e-7e913b93fa70	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
49efdc5d-7416-4144-90a5-048d2faf4cb8	74242d01-2ac7-4563-b476-b32be671b660	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-18 09:08:41.947
d9c7991e-f694-453e-8625-278ee8e77827	ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.748	2026-06-18 14:21:16.783
ca30db45-2cde-40ea-9af6-efd16289b80c	fc50653c-9b9b-498a-8d0f-d201ffd477c1	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:07:38.608	2026-06-22 08:07:38.608
37411291-09d2-435a-814f-a45ebe3f42f0	b1858309-9bd6-4e6a-9e40-43b3e21bf3fb	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:07:48.934	2026-06-22 08:07:48.934
775df214-a772-4284-bc53-5ca667ea9887	e5ffb65a-444d-41a3-8fb2-bcf437b7f704	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:07:52.693	2026-06-22 08:07:52.693
60029615-35a6-42fd-b2f4-4d44bef6330d	523986c6-61c8-45f4-a57d-b56106035714	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-26 11:40:46.66
d6c84512-d87a-4eb1-8001-3e9ba6a356d5	5c08bb58-4a5f-429d-872e-8d88fa6ebe54	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 09:08:41.947	2026-06-26 11:40:42.049
ccf0987f-ecaf-4a9c-a1f7-1ddc76c4d3a8	d00f1664-9b94-4e47-b2dd-f17cfa3dfa36	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 14:14:29.739	2026-06-18 14:14:29.739
09629b20-4cf5-4e7e-91a2-2613ed9a666c	53f3dfd6-c3a5-4e06-ba1e-7e913b93fa70	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
f034ebc9-74ca-4b45-9785-2ba0c4aa9738	74242d01-2ac7-4563-b476-b32be671b660	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.751	2026-06-18 14:21:16.784
33faac5e-5826-40d3-9e5e-7ed02635f429	627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.751	2026-06-18 14:21:16.784
8cfa99ad-172d-488f-9920-f5be527acf5f	4feba9f3-969d-40ac-88c2-30419fd86d21	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.784
546d25c9-cdd6-4672-8a0a-46d495322d5d	b2c6d1a5-1627-44e8-b263-0c06b62ef9e7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.784
d3482703-2963-45bd-b397-715ae88b1cb3	b04d899f-1cb7-4a2f-a261-5b5af09c4891	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.784
3a03f12f-de7d-4eb6-974e-48a2fed16918	05530528-efca-4c8b-a31e-fd121308fa67	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:07:59.425	2026-06-22 08:07:59.425
d3d4f506-0cb0-4801-b33e-ad04ebfc6544	b33ae8a5-41d4-4c7a-ad77-c86fb926100f	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:08:04.834	2026-06-22 08:08:04.834
ed13ebbc-5147-4b7e-9fac-04d8c53fd95e	8e60fd47-28f2-496a-a51b-adb7c410c9a0	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:08:46.221	2026-06-22 08:08:46.221
c33be41d-899a-46ba-9fc7-0720f4d69ff9	9d2e6dee-efad-47fa-ac93-fc857bc056f9	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
e8280580-6850-49fc-b53d-dca087966e23	f5975328-6c65-4743-baaf-2226259f064c	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
e9d0ee2a-e6c0-410d-88dc-d8a4caa44ff9	a04ad0ab-1572-4ca1-9765-b336bb93b065	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.784
f44cfa2a-56ec-43d9-8a9b-d8cb1a3b7d87	babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
e0cbef7d-2f3d-44f8-a0e8-eddae0e88828	ad5161df-9521-454a-ad8c-2466484c18aa	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.75	2026-06-18 14:21:16.785
de0d95dd-02ff-45c4-96f9-21a42f76559e	90f9eaec-c536-450c-aeda-e9c97187e4d7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.785
fe54bc86-0bea-4a9e-a211-4864e954b7a2	c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	AGAINST	2026-06-18 14:24:54.458	2026-06-18 14:55:15.476
58f98255-c467-407f-b374-44ed4045ea2e	6cd981e3-f9a7-40e1-9674-791addeec7b6	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:08:35.241	2026-06-22 08:08:35.241
ae0d0035-1c76-4213-b9c2-e94fb9d38672	8c1b52ad-ddce-4be3-9ab8-79defe5eabd9	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
d7da9209-3e6a-4e2f-9d59-eda8f2caf346	401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
4783146e-27fe-44d2-818d-a6e4a5de74ae	41e4ce1f-02cf-4d3e-a480-cb15071cb605	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
2f7481fd-fdb6-4ee0-8b0a-93a06a081f0a	bd17e255-c24e-4cae-a92b-db36ad181ea7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
b88db07d-d653-415b-b94e-8e6eb824ddfa	fd1177b5-0ef6-4263-903b-11fea4fc0f6f	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
951d3732-872a-49ed-8329-8830601876a3	65a63b16-056a-457b-9cc4-5c2769cb5e70	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
9b93caa1-8d53-4d8d-8cbc-c40da2320d45	d00f1664-9b94-4e47-b2dd-f17cfa3dfa36	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	AGAINST	2026-06-18 14:55:15.481	2026-06-18 14:55:15.481
486897f3-9352-43ac-a6ff-8002d9681570	31d6221f-37e8-470f-8f83-97748f879e08	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:15:06.022	2026-06-22 08:15:06.022
b987c913-045c-4444-9539-b18f0e932f83	3183ddbc-352b-438b-8c22-4249761c42ab	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:15:35.544	2026-06-22 08:15:35.544
e4e194a0-ce25-49ac-a9bc-f43ba3319472	1c0e4d6d-6452-41bc-8896-1d166f049f85	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:15:46.83	2026-06-22 08:15:46.83
0b3c98af-93e4-4fca-a056-655a7b12e876	ae9ded01-0098-4cb9-bd0f-cc069dd37137	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:15:57.392	2026-06-22 08:15:57.392
49b9684f-923f-4e83-b7dd-15e2093b8d53	bf90bf6a-9d84-4fde-b1ac-12f4ef03ce15	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:16:13.693	2026-06-22 08:16:13.693
5fc60b31-8705-49a3-8ba8-f0e486f284c1	42afe479-4951-46a7-9cd5-7258c1c290b0	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:16:19.94	2026-06-22 08:16:19.94
d2e93778-8833-4ad6-aca6-d65a3e4cea8e	d9fd02c9-b736-4b85-91d7-291e6280d2bc	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-22 08:16:24.986	2026-06-22 08:16:24.986
7b7d7a11-b011-4253-a645-d67078499fe7	0c6068cf-52d8-4933-9036-b55a8deb4aec	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:16:31.932	2026-06-22 08:16:31.932
b5e5e82b-b398-48bc-a023-5348f76cea46	cb64ba7d-1367-45b3-86e2-ba340b0d7528	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 05:56:14.108	2026-06-24 05:56:14.108
bb39a3d2-1141-4f52-9d55-cfbb4f7db137	c58b2b1b-722f-4aaf-8e7c-c8b19f5ca877	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.751	2026-06-18 14:21:16.784
c6683306-85ca-4994-97d3-e1ece394974b	523986c6-61c8-45f4-a57d-b56106035714	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.751	2026-06-18 14:21:16.784
ddbda02e-8735-4380-b7f9-16a2361bef1c	db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.751	2026-06-18 15:27:40.309
492ba644-1a1f-479a-9dd9-6dd1fac6d0cb	37a8b454-91f7-44fc-9ef4-b1b6819bcdbb	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.786
e993a5ce-f541-4287-950b-714b9c58a685	627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
9ab5b525-6d23-49a8-aa0d-67c46e66a27e	37a8b454-91f7-44fc-9ef4-b1b6819bcdbb	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
fb8a1fe3-8b9f-4f53-acde-8b62a4a9eae4	ae99e942-7e2e-427d-b423-ab6cb6e2d709	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.748	2026-06-18 14:21:16.784
a8add940-9b11-45ac-907e-c75b240cbeb9	c65402df-2ae0-4e69-a3b0-4097638ac705	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.748	2026-06-18 14:21:16.783
0dade8c6-57ab-4902-8fdb-c452da0b8010	db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-18 14:55:15.476
4f8f91ea-3f3c-45dc-b698-14a83598d8eb	9d2e6dee-efad-47fa-ac93-fc857bc056f9	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
51036848-eb01-47d6-b9d3-9439fe4a29f6	bd17e255-c24e-4cae-a92b-db36ad181ea7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
fdad3263-e112-4ed9-b133-72d0b1313d65	45a1549c-2968-440a-beec-cab47819f4e0	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
d8ec77d8-d9b1-4895-a7d6-d4459601cfda	65a63b16-056a-457b-9cc4-5c2769cb5e70	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-18 22:04:34.354
21fcd6cb-e61e-45e8-b31f-da35cc0ca290	4feba9f3-969d-40ac-88c2-30419fd86d21	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
8082ce4d-3337-4786-a289-5bf6f82880ff	ff5edc32-351d-4202-9503-64930ec1298a	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
5281db6c-8e24-4691-9514-93d54b85c368	ebf72fd1-dbd2-4390-8203-82593be3d422	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.477
8a4b2aa7-9fb4-4f57-81fc-fd25ca3494ef	e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.751	2026-06-18 14:21:16.783
d441a17e-b4fd-47c6-ba47-8ec7b9fd5c6b	babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
376bf3b8-e1a6-4fb0-8bad-c15caa2e2fcb	b04d899f-1cb7-4a2f-a261-5b5af09c4891	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.616	2026-06-18 14:55:15.481
f94a02ed-3c6b-40f8-bd67-2ec9fff770c7	c65402df-2ae0-4e69-a3b0-4097638ac705	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.616	2026-06-18 14:55:15.482
55b2c598-7fde-4dad-a794-0a7c83abfed3	fd1177b5-0ef6-4263-903b-11fea4fc0f6f	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
5130ce10-d8f8-4c90-b3ca-f894a67cfedb	401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.615	2026-06-18 14:55:15.481
13e3bd88-c637-4ff1-8cff-60d0ae6aa650	ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.616	2026-06-18 14:55:15.482
3222e7c4-641d-4ae6-be0c-f752d4b71bab	90f9eaec-c536-450c-aeda-e9c97187e4d7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
71be6c47-172c-4529-ba1c-5178e342eba5	5e7031a7-372f-446a-99b1-0ad091b523a0	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.615	2026-06-18 14:55:15.477
9ce9e8c7-312b-4a6d-a26a-183416a56537	ebf72fd1-dbd2-4390-8203-82593be3d422	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.748	2026-06-18 14:21:16.783
a01707ca-8cd7-4ec2-a40e-1c6f06c4b522	5c08bb58-4a5f-429d-872e-8d88fa6ebe54	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
1711e58e-5bdf-4699-a90e-2e4fae59cfe8	ff5edc32-351d-4202-9503-64930ec1298a	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
eb13333d-9ed0-46df-88fe-3c5cc2499f09	0f12fb3b-4348-4072-955c-ce31ad351117	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.75	2026-06-18 14:21:16.783
3802a430-355c-450e-b40e-a0ad756f9128	45a1549c-2968-440a-beec-cab47819f4e0	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-18 09:17:33.75	2026-06-18 14:21:16.784
57f8a5fa-1993-4ea2-ad8e-9451c3340c67	c9f0b379-321a-463f-a9df-72a07229e702	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.751	2026-06-18 14:21:16.784
508d60ca-0f65-4bb5-b6e1-7899745e03d8	ad5161df-9521-454a-ad8c-2466484c18aa	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
c7219641-5fd0-4eb1-8f75-c60e7744aebc	c9f0b379-321a-463f-a9df-72a07229e702	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
58621af3-1dd6-492f-b15d-256f778c17c3	cf3187cf-305b-4856-9f90-954048f811d1	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:15:24.943	2026-06-22 08:15:24.943
6a9ff54d-9217-4347-942a-c9cdc39605b1	b1858309-9bd6-4e6a-9e40-43b3e21bf3fb	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 05:57:43.642	2026-06-24 05:57:43.642
4b2bc3f1-15d7-46ad-b8f8-4fea2448eded	9a2137df-d9a2-48a6-80d7-a2b2bee54437	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.626	2026-06-18 14:55:15.482
c29f2fe7-790a-40c9-95d3-60fbef95ac17	0e01da25-664b-4dd3-9fbb-1c1c93043e5a	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 15:26:07.293	2026-06-18 15:26:07.293
e8512cf3-bccd-4915-b162-dd4ac98d304c	fc288c48-ce26-4ce5-b165-751d7b935d62	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 15:26:12.976	2026-06-18 15:26:12.976
ddaa3d1c-0ebb-4a23-b655-d742ac2d6326	c5d56c05-7306-444c-84c5-af3e5171c0f8	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-22 08:24:20.857	2026-06-22 08:24:20.857
b4846e7c-8f99-40d4-9de1-35bbf273ef07	2be2327f-978e-4342-8683-a8bcf5869f5b	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:24:43.955	2026-06-22 08:24:43.955
916b44af-d5e6-48b8-a90b-b5e65e23519e	d8e2f4dc-7428-4e96-85b7-8fb6f9b66e6d	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-22 08:26:07.795	2026-06-22 08:26:07.795
1dd90355-7329-4dfe-8716-e191f9a41723	b19eee5b-7704-4f19-b8fe-30f8f198f77f	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-22 08:26:20.669	2026-06-22 08:26:20.669
3664f5d3-64f1-45e3-a611-e6be6626a0ec	b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-22 08:26:25.263	2026-06-22 08:26:25.263
dd922402-51bc-4794-8345-721c67d4a475	41e4ce1f-02cf-4d3e-a480-cb15071cb605	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 09:08:41.947	2026-06-22 08:26:53.245
57b401b3-c9e5-438c-a322-d84fae92b257	78d7f1a3-0050-4538-8d8a-8a8ff49f8e21	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:27:08.676	2026-06-22 08:27:08.676
616611d5-68d6-490f-982d-a449e80e8949	c3fee9e5-1d6d-4b04-98d0-587b6dc9b7fe	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:22.251	2026-06-22 08:27:22.251
c5d9622c-18f0-4be6-9118-7d5bc2e1e5d3	c8c5fbe4-8bdb-4e0f-a262-58b78d09916c	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:28.269	2026-06-22 08:27:28.269
2a1a1530-84c7-46c4-b2fc-71a4a63bccc3	07c4ea9d-0b30-45e4-a1c0-6570077a26e8	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:33.717	2026-06-22 08:27:33.717
5bd7dc01-c1de-411a-b944-00e654b08510	f399d00c-ea31-4adc-8143-c338c181b129	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:37.925	2026-06-22 08:27:37.925
688bf159-6bd3-480a-80eb-14cf9de09252	700d20d2-5e4d-40dd-b71d-58dca2c994de	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:44.353	2026-06-22 08:27:44.353
10c071b6-8bc2-4868-9034-6c6b24893cc4	b4afe23a-c53c-471e-a3df-6ed9ab42f537	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:27:55.85	2026-06-22 08:27:55.85
ab6555e0-afdf-49e5-a1b4-5028e9d9d9d2	76bb0eee-4ea3-4a58-93ac-6105f218def7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-22 08:28:00.072	2026-06-22 08:28:00.072
fbf33945-36e5-47dc-9882-ae8cb67cd57e	f48d4323-8a11-4af4-86db-9ebdadc48655	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:28:10.872	2026-06-22 08:28:10.872
8180bb1d-c738-4877-8799-bd46e2ebf6d6	6e7439a0-448a-4675-b6d5-888e9a852c82	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:28:17.334	2026-06-22 08:28:17.334
5a4cb3e2-a0f9-41a5-a688-99a114b231a4	3e2b92dd-5dec-45b2-b0e7-c86c4bb71405	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-22 08:28:22.5	2026-06-22 08:28:22.5
09700d0b-6772-41d9-8f14-d3de301adf54	eb9900c8-d4b1-48b2-b708-7bc199a150c8	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:28:30.071	2026-06-22 08:28:30.071
e0993fbe-3128-45a4-a179-92b0339a961c	41e4ce1f-02cf-4d3e-a480-cb15071cb605	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.617	2026-06-24 05:55:09.398
56fcf44d-4eb1-4abb-a3fe-919b276b6d3b	d9fd02c9-b736-4b85-91d7-291e6280d2bc	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-24 16:26:09.18	2026-06-24 16:26:09.18
7b712a32-e66b-4713-8136-9ba3d22505e1	c58b2b1b-722f-4aaf-8e7c-c8b19f5ca877	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.617	2026-06-18 14:55:15.476
2ad9deb9-c1b3-411b-9dee-905e450fcdfb	53f3dfd6-c3a5-4e06-ba1e-7e913b93fa70	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.62	2026-06-18 14:55:15.482
2889a568-2e6c-406a-bd9a-2c71240d1eed	8993e7ea-6180-4f78-9e66-ff9869c802d9	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 15:26:26.894	2026-06-18 15:26:26.894
f4c3495b-3780-499d-baf1-8f2f6fa0b108	3755b71a-39ab-407e-9d00-5de8867a8ce3	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:28:37.969	2026-06-22 08:28:37.969
7dd698bd-f3c5-4028-91ca-807f7c9c1386	cb64ba7d-1367-45b3-86e2-ba340b0d7528	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:29:00.367	2026-06-22 08:29:00.367
a3af09fc-66bf-47b4-b502-9d00cd5c8e81	fc50653c-9b9b-498a-8d0f-d201ffd477c1	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:06.115	2026-06-22 08:29:06.115
2b44c4c7-5c31-4696-bc03-598b28a22db3	b1858309-9bd6-4e6a-9e40-43b3e21bf3fb	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-22 08:29:14.223	2026-06-22 08:29:14.223
1d9f365b-ecde-4157-8d16-ec77c05603c1	e5ffb65a-444d-41a3-8fb2-bcf437b7f704	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:18.662	2026-06-22 08:29:18.662
1644f6fe-ba77-491f-a6ab-d198dfe8e0fa	05530528-efca-4c8b-a31e-fd121308fa67	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	NOT_REALLY	2026-06-22 08:29:32.614	2026-06-22 08:29:32.614
a9115874-89dd-4758-a18c-988ba00b5c49	b33ae8a5-41d4-4c7a-ad77-c86fb926100f	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:36.866	2026-06-22 08:29:36.866
c2c5096f-3d62-42c3-9e4d-be67f80fa6e4	6cd981e3-f9a7-40e1-9674-791addeec7b6	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:41.685	2026-06-22 08:29:41.685
e1b9c446-639e-40e7-9604-12e073ac563f	8e60fd47-28f2-496a-a51b-adb7c410c9a0	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-22 08:29:48.399	2026-06-22 08:29:48.399
d59f507a-8062-4a8d-9cf7-5492a1255699	31d6221f-37e8-470f-8f83-97748f879e08	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:52.215	2026-06-22 08:29:52.215
754cca1a-6375-4c19-aacb-6cd2678dd9fa	cf3187cf-305b-4856-9f90-954048f811d1	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:29:59.165	2026-06-22 08:29:59.165
dca7f166-e23e-40be-bbeb-b3134a830b25	3183ddbc-352b-438b-8c22-4249761c42ab	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:30:13.407	2026-06-22 08:30:13.407
3338bbbd-b566-47b4-a20d-71e4ed2ba78e	1c0e4d6d-6452-41bc-8896-1d166f049f85	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:30:22.777	2026-06-22 08:30:22.777
236d2d72-00fd-4c9b-ac19-043d763e7e3c	ae9ded01-0098-4cb9-bd0f-cc069dd37137	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:30:37.624	2026-06-22 08:30:37.624
cbe2fc4f-04ba-4507-8cfb-07385292de3c	bf90bf6a-9d84-4fde-b1ac-12f4ef03ce15	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:30:42.047	2026-06-22 08:30:42.047
529e7350-c0c7-40e3-8b12-0cc597ec2c7d	42afe479-4951-46a7-9cd5-7258c1c290b0	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:30:44.114	2026-06-22 08:30:44.114
64e24555-db1d-48e4-9547-09543093c0d9	d9fd02c9-b736-4b85-91d7-291e6280d2bc	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-22 08:30:46.957	2026-06-22 08:30:46.957
8ddcf6eb-a579-48e3-a90f-7fdef80ae74b	0c6068cf-52d8-4933-9036-b55a8deb4aec	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	AGAINST	2026-06-22 08:30:49.894	2026-06-22 08:30:49.894
0b86aab3-7838-472f-aaf9-8cdbfca010df	0c6068cf-52d8-4933-9036-b55a8deb4aec	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:26:57.951	2026-06-24 16:26:57.951
0d0136a0-4d92-453a-9bc9-1bff860888e5	678873d4-f120-48dc-87db-59ca5b1b80a7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 15:26:57.633	2026-06-18 15:26:57.633
cc2e6025-8abd-45cf-b4aa-6df4b9a86caf	bd17e255-c24e-4cae-a92b-db36ad181ea7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 19:09:02.021
85e1d86e-777e-45c9-b880-bd46ff9c66ce	a04ad0ab-1572-4ca1-9765-b336bb93b065	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.482
0fe7308f-40bd-4944-93af-8b3e0aa22f15	86792acf-021a-408f-a2a5-a3d3be9e996d	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.615	2026-06-18 14:55:15.481
18b7490d-6b01-48ac-8265-a95705fede69	e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.619	2026-06-18 14:55:15.482
844d7d79-03af-4474-a446-d1e6a6a8b84b	ff5edc32-351d-4202-9503-64930ec1298a	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.738
b7338b5b-299a-421e-bcb6-c3d4a0d390c2	74242d01-2ac7-4563-b476-b32be671b660	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.62	2026-06-18 14:55:15.477
32a643cd-a3a7-4d90-9614-6696ace95cd6	8c1b52ad-ddce-4be3-9ab8-79defe5eabd9	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 09:39:33.619	2026-06-18 14:55:15.481
56921847-afca-4b7e-95d3-2bbb6ac867b4	b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	NOT_REALLY	2026-06-22 23:07:34.091	2026-06-22 23:07:34.091
3ca68db8-50f7-4b66-9384-d590d8115eed	0f12fb3b-4348-4072-955c-ce31ad351117	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
5b497372-e87d-4c95-885f-ab5be7c92127	b2c6d1a5-1627-44e8-b263-0c06b62ef9e7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-18 09:39:33.617	2026-06-18 14:55:15.481
eaa169ee-394a-4098-aba6-891d0052c691	ae99e942-7e2e-427d-b423-ab6cb6e2d709	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-18 09:39:33.616	2026-06-18 14:55:15.481
bac918e3-3cb4-40aa-a586-36e9536a22ca	b04d899f-1cb7-4a2f-a261-5b5af09c4891	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
0299559c-75d4-4aa2-8bb6-777f09c0b365	53f3dfd6-c3a5-4e06-ba1e-7e913b93fa70	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
cd8ee7b6-21eb-4302-a041-58d6037ed59d	c65402df-2ae0-4e69-a3b0-4097638ac705	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.375	2026-06-18 14:14:29.739
2cd349a7-651c-4ef2-8b6d-4d326f257f46	f5975328-6c65-4743-baaf-2226259f064c	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
0967972f-3f67-42c1-95c0-b5aea5457f86	627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-18 10:48:01.373	2026-06-18 14:14:29.742
9b484565-1f15-4476-8e04-0e33d2642709	ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
349d41f5-67be-4801-ab24-652da0018a57	90f9eaec-c536-450c-aeda-e9c97187e4d7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	AGAINST	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
8994e4b4-a4fe-405c-b061-05a30f9992ae	0f12fb3b-4348-4072-955c-ce31ad351117	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
d466cada-eafd-4667-9b4e-ae888762cd8d	45a1549c-2968-440a-beec-cab47819f4e0	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
88b5b8b7-f374-4734-8aba-8671b1aaad85	f5975328-6c65-4743-baaf-2226259f064c	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.619	2026-06-18 22:04:13.327
ef0cfe02-d541-42ee-b574-9c46519bb9d2	4feba9f3-969d-40ac-88c2-30419fd86d21	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
a40ad62a-d5ae-4545-b9d9-103e9c20e796	9d2e6dee-efad-47fa-ac93-fc857bc056f9	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.373	2026-06-18 14:14:29.738
84846cad-c0b1-4f78-9be3-8038282696c5	ad5161df-9521-454a-ad8c-2466484c18aa	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
45a78681-f009-49bf-90bf-21aa8cc04d83	e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	NOT_REALLY	2026-06-22 23:07:35.866	2026-06-22 23:07:35.866
47bdf198-454a-4a39-a848-e9b626b02ee6	b2c6d1a5-1627-44e8-b263-0c06b62ef9e7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
8d7c5cb9-9eec-4c66-84a4-0177cec2ff40	fd1177b5-0ef6-4263-903b-11fea4fc0f6f	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.375	2026-06-18 14:14:29.742
852c7774-3c18-46b4-bf28-8d15220970e8	5c08bb58-4a5f-429d-872e-8d88fa6ebe54	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.619	2026-06-18 14:55:15.476
bdd63a88-c901-4d4a-8c01-caef351c6903	523986c6-61c8-45f4-a57d-b56106035714	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-18 09:39:33.619	2026-06-18 14:55:15.48
7c1251df-e75a-4910-8a3f-194378eb6f09	401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	OK	2026-06-22 23:10:11.038	2026-06-22 23:10:11.038
f3afca45-d66a-4d1b-a458-53bb76981639	c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	OK	2026-06-22 23:10:13.233	2026-06-22 23:10:13.233
18ec8003-f91d-4049-97a8-aa29409443a6	05530528-efca-4c8b-a31e-fd121308fa67	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:30:02.456	2026-06-24 16:30:02.456
c7c95ebd-8588-4d68-8049-75ba5f48f0ec	86792acf-021a-408f-a2a5-a3d3be9e996d	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.373	2026-06-18 14:14:29.738
1cb27a9c-79d2-4b9b-846b-01b30f4c2b11	74242d01-2ac7-4563-b476-b32be671b660	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.373	2026-06-18 14:14:29.738
a9246ac1-73ff-454c-a588-39d3fba1f548	9a2137df-d9a2-48a6-80d7-a2b2bee54437	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.375	2026-06-18 14:14:29.738
6d33b78e-99d4-4b10-8bd1-f23d474ce61c	5c08bb58-4a5f-429d-872e-8d88fa6ebe54	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.376	2026-06-18 14:14:29.738
35273d79-a89a-4cfb-b73c-588698c1fe29	8c1b52ad-ddce-4be3-9ab8-79defe5eabd9	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
37c6b8d4-ede5-4eb9-bf06-bf2c7b33a8db	3755b71a-39ab-407e-9d00-5de8867a8ce3	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:30:17.536	2026-06-24 16:30:17.536
989cecd9-2a74-4928-9d58-9da11bed8acf	401a8c4d-93c4-4432-8e3c-a2cf0147204a	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.375	2026-06-18 14:14:29.742
659d4063-d8e2-411e-818c-21098c450bc5	41e4ce1f-02cf-4d3e-a480-cb15071cb605	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
fa293355-9873-4b91-9bde-d9212ddf6ef8	ae99e942-7e2e-427d-b423-ab6cb6e2d709	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.742
516ac548-79f5-4b90-a97b-2447cd5fc0b3	8993e7ea-6180-4f78-9e66-ff9869c802d9	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 16:05:45.947	2026-06-18 16:05:45.947
bdfa955f-be73-4aa9-bbbe-ac3af5b087d8	fc288c48-ce26-4ce5-b165-751d7b935d62	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 16:05:48.848	2026-06-18 16:05:48.848
46aeb5f7-978c-475e-b63b-96bfbd3539df	678873d4-f120-48dc-87db-59ca5b1b80a7	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 16:05:51.25	2026-06-18 16:05:51.25
d6885a9a-1f11-491f-833d-1553f73f79cb	0e01da25-664b-4dd3-9fbb-1c1c93043e5a	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 16:06:14.757	2026-06-18 16:06:14.757
be4b6ad7-ac59-4c50-b112-ca01bfcd57bc	babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	OK	2026-06-22 23:10:31.058	2026-06-22 23:10:31.058
619f961c-f141-400e-a11b-79579f875a7a	627016c5-ae7c-4f3d-88fd-cadf388ddcb3	b389876f-9a01-4dda-b3a5-6b673a789468	63bb1ed9-432c-4638-bad3-50196226451c	OK	2026-06-22 23:10:37.879	2026-06-22 23:10:37.879
279024bc-5b43-419c-96c4-2a3fd8572820	fc50653c-9b9b-498a-8d0f-d201ffd477c1	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:30:31.845	2026-06-24 16:30:31.845
02ed11dc-0e35-4c37-9f73-4eb1b63f26d2	e5ffb65a-444d-41a3-8fb2-bcf437b7f704	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:30:49.604	2026-06-24 16:30:49.604
20ba510b-1665-4502-9a5f-b1ede10fb795	8e60fd47-28f2-496a-a51b-adb7c410c9a0	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:31:27.436	2026-06-24 16:31:27.436
3c33f8ad-edc1-4850-a832-0549b614b699	37a8b454-91f7-44fc-9ef4-b1b6819bcdbb	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
70496e48-2b78-4072-8fde-f0b343ab7d3d	e31810e5-7a33-4a5d-a3d8-8d01128b5deb	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
6c8b5ca4-e0e7-4279-b272-158ee2a3c2f5	c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 17:13:56.468	2026-06-18 17:13:56.468
5cffd394-add7-4ac2-8a01-7491885158eb	0e01da25-664b-4dd3-9fbb-1c1c93043e5a	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	OK	2026-06-18 17:14:20.046	2026-06-18 17:14:20.046
32c18414-56c7-47f0-9e4f-0c2fd191f22e	d00f1664-9b94-4e47-b2dd-f17cfa3dfa36	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 17:15:25.338	2026-06-18 17:15:25.338
2e36543c-e0f2-44f8-88dd-e13eb9f46da6	9d2e6dee-efad-47fa-ac93-fc857bc056f9	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 17:15:30.208	2026-06-18 17:15:30.208
d0dc3ae4-c4f3-4a77-8546-75e93de7d3a7	8993e7ea-6180-4f78-9e66-ff9869c802d9	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 17:15:33.703	2026-06-18 17:15:33.703
6123364a-5ffb-4a8e-9eb9-4f0b2ba924d9	fc288c48-ce26-4ce5-b165-751d7b935d62	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	MUST	2026-06-18 17:15:38.8	2026-06-18 17:15:38.8
83a35b52-25b3-46fb-9f41-d383859fc675	678873d4-f120-48dc-87db-59ca5b1b80a7	b389876f-9a01-4dda-b3a5-6b673a789468	fa102463-a816-4a12-945d-cb3d479c694e	IF_OTHERS	2026-06-18 17:15:46.085	2026-06-18 17:15:46.085
d8144839-a6c9-41da-85c2-8743c5091f05	b33ae8a5-41d4-4c7a-ad77-c86fb926100f	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:31:02.633	2026-06-24 16:31:02.633
e916c8d4-e48c-44c0-ac9b-a1f475eb9368	3183ddbc-352b-438b-8c22-4249761c42ab	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:31:59.135	2026-06-24 16:31:59.135
ad2c1523-3bb0-4dc4-bdf0-f59a235dc2da	bf90bf6a-9d84-4fde-b1ac-12f4ef03ce15	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:32:13.265	2026-06-24 16:32:13.265
7e89877c-a5ce-4cdd-b9cd-16762fc16ba6	6cd981e3-f9a7-40e1-9674-791addeec7b6	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:32:52.694	2026-06-24 16:32:52.694
fe7496c4-b1e2-4375-a01c-29a4e96728f3	65a63b16-056a-457b-9cc4-5c2769cb5e70	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
f2c449ae-3e5e-4fb7-83ec-41b37429844d	ebf72fd1-dbd2-4390-8203-82593be3d422	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
1aa5bca1-f612-4340-abd0-6f6aca8be744	0e01da25-664b-4dd3-9fbb-1c1c93043e5a	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 18:49:09.885	2026-06-18 18:49:09.885
ae859bcb-327c-4293-b151-30606d257ef2	8993e7ea-6180-4f78-9e66-ff9869c802d9	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 18:50:31.028	2026-06-18 18:50:31.028
a455ac27-8513-4812-9b3c-832ceaf0458e	fc288c48-ce26-4ce5-b165-751d7b935d62	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 18:51:25.238	2026-06-18 18:51:25.238
6c7326df-a36b-4e98-9138-854775d195ec	31d6221f-37e8-470f-8f83-97748f879e08	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:34:49.916	2026-06-24 16:34:49.916
a72ef761-2683-4fc8-98bc-07cae79daa34	ae9ded01-0098-4cb9-bd0f-cc069dd37137	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:36:13.078	2026-06-24 16:36:13.078
19ede02c-7885-400e-9821-a6144814245a	cf3187cf-305b-4856-9f90-954048f811d1	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	AGAINST	2026-06-24 16:37:09.772	2026-06-24 16:37:09.772
be7a6762-edfb-41c5-bf1f-e3f9818627c5	3e2b92dd-5dec-45b2-b0e7-c86c4bb71405	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:37:17.112	2026-06-24 16:37:17.112
6aab2cbc-7745-427f-83e9-95d01c9e91d4	76bb0eee-4ea3-4a58-93ac-6105f218def7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:37:22.457	2026-06-24 16:37:22.457
d9a82a6a-083e-4f1c-8019-6f470ae09fcc	babfad6b-2bc5-4152-965c-071d03d037a1	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
8c38c6fa-ba33-4b4f-a35b-38c75fffe862	a04ad0ab-1572-4ca1-9765-b336bb93b065	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-18 10:48:01.377	2026-06-18 14:14:29.739
a3916bdc-5995-485b-bcc7-eca365feb63e	678873d4-f120-48dc-87db-59ca5b1b80a7	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-18 22:02:34.765	2026-06-18 22:02:34.765
1709745e-ae42-49cb-8503-d009df42f4e4	42afe479-4951-46a7-9cd5-7258c1c290b0	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:35:06.997	2026-06-24 16:35:06.997
cfe62c5e-0edf-497c-bb42-efd3ab1f3335	1c0e4d6d-6452-41bc-8896-1d166f049f85	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:35:24.675	2026-06-24 16:35:24.675
caa3f692-988c-4b9c-b6fd-b3ddbdf57aeb	f48d4323-8a11-4af4-86db-9ebdadc48655	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:38:32.932	2026-06-24 16:38:32.932
53757b69-e1d0-4046-b858-27d8d9b80e9c	c58b2b1b-722f-4aaf-8e7c-c8b19f5ca877	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
e4d1c8e4-48ea-4f59-8427-6e77ec661fab	d8e2f4dc-7428-4e96-85b7-8fb6f9b66e6d	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:38:47.815	2026-06-22 07:38:47.815
c61f9bb0-af12-4b9d-8758-5c1a21d5dd76	b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:38:59.159	2026-06-22 07:38:59.159
3ad8d6fa-c1d8-4d9a-91fb-b3b45888966e	b19eee5b-7704-4f19-b8fe-30f8f198f77f	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:39:08.694	2026-06-22 07:39:08.694
60687b50-5764-4fc7-8ff3-51ca58881d3e	c5d56c05-7306-444c-84c5-af3e5171c0f8	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:39:23.168	2026-06-22 07:39:23.168
10f55cec-c761-43d1-8aa9-6ac0da5d6519	2be2327f-978e-4342-8683-a8bcf5869f5b	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:39:35.783	2026-06-22 07:39:35.783
e1c497d0-9377-4894-8602-cd2e8ff901b2	78d7f1a3-0050-4538-8d8a-8a8ff49f8e21	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:39:46.311	2026-06-22 07:39:46.311
c5a2c961-3577-4c92-b1f7-eab5be7f1aa4	c3fee9e5-1d6d-4b04-98d0-587b6dc9b7fe	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:39:56.618	2026-06-22 07:39:56.618
99a4430a-359a-47b6-952f-1f7946b07fd5	c8c5fbe4-8bdb-4e0f-a262-58b78d09916c	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:40:03.519	2026-06-22 07:40:03.519
fce1b19d-a7c0-45e5-af58-57bf0bb759f6	07c4ea9d-0b30-45e4-a1c0-6570077a26e8	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:40:08.846	2026-06-22 07:40:08.846
ab3e3264-3b1c-42c0-88e1-980165326e25	f399d00c-ea31-4adc-8143-c338c181b129	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:40:17.08	2026-06-22 07:40:17.08
c65b8acc-6f3e-452c-9f8d-427b424d0ebb	700d20d2-5e4d-40dd-b71d-58dca2c994de	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:40:25.215	2026-06-22 07:40:25.215
731ce8a1-ba5a-4928-b179-76f1e0dd648a	b4afe23a-c53c-471e-a3df-6ed9ab42f537	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:40:41.033	2026-06-22 07:40:41.033
67f93372-dd8f-484e-b1a9-1cc656d9b965	76bb0eee-4ea3-4a58-93ac-6105f218def7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:40:54.601	2026-06-22 07:40:54.601
7c30ad7e-5ded-4538-a308-dfa4134d14ce	f48d4323-8a11-4af4-86db-9ebdadc48655	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:41:04.583	2026-06-22 07:41:04.583
918fc1a7-9a3e-4d63-931f-cb2f98cc5138	6e7439a0-448a-4675-b6d5-888e9a852c82	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:41:07.841	2026-06-22 07:41:07.841
29eccb49-99e2-4d58-942b-f8bf2f9668c4	eb9900c8-d4b1-48b2-b708-7bc199a150c8	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:40:07.315	2026-06-24 16:40:07.315
b6c99e1c-9d21-4e92-bc74-e188db040a15	07c4ea9d-0b30-45e4-a1c0-6570077a26e8	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	NOT_REALLY	2026-06-24 16:40:11.195	2026-06-24 16:40:11.195
df81be0c-8e72-4b25-bdb9-bc4e08f56431	f399d00c-ea31-4adc-8143-c338c181b129	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:40:54.796	2026-06-24 16:40:54.796
f5f7a277-dd18-4158-a5f2-41a562d1c853	c3fee9e5-1d6d-4b04-98d0-587b6dc9b7fe	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:41:38.889	2026-06-24 16:41:38.889
a71b4ec3-445b-4139-b70c-c531438adcba	c8c5fbe4-8bdb-4e0f-a262-58b78d09916c	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:41:52.447	2026-06-24 16:41:52.447
cfe0d745-3f46-4525-be93-f895683711cc	2be2327f-978e-4342-8683-a8bcf5869f5b	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	MUST	2026-06-24 16:43:45.761	2026-06-24 16:43:45.761
b3c99461-8123-48c4-a88b-680ea735af8e	81130cfa-cc64-49b8-bc6a-76fdde38833f	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-26 13:22:19.546	2026-06-26 13:22:19.546
bb7bd378-27f8-4a1a-8667-a0d7bcf9af64	8326f3d0-3a51-4f94-b5c9-a2e1601e2305	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-26 13:22:20.625	2026-06-26 13:22:20.625
d89184b1-a602-47e6-946e-7b989f5e1dad	3e2b92dd-5dec-45b2-b0e7-c86c4bb71405	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:41:17.179	2026-06-22 07:41:17.179
2f093dca-b0d8-41aa-a771-22f52db3fc80	eb9900c8-d4b1-48b2-b708-7bc199a150c8	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:41:22.994	2026-06-22 07:41:22.994
72dd5750-435e-4596-bc1f-b76e4f874afb	3755b71a-39ab-407e-9d00-5de8867a8ce3	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:41:34.279	2026-06-22 07:41:34.279
08bd07f8-01fd-48dc-b7ec-144bdce2f411	cb64ba7d-1367-45b3-86e2-ba340b0d7528	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:41:39.431	2026-06-22 07:41:39.431
e49e2623-0c3e-4a66-8849-b93a25d26086	fc50653c-9b9b-498a-8d0f-d201ffd477c1	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:41:49.921	2026-06-22 07:41:49.921
e84c6863-4752-457c-8c61-f3c2266e9885	b1858309-9bd6-4e6a-9e40-43b3e21bf3fb	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:42:01.522	2026-06-22 07:42:01.522
1f981bd0-d377-4882-9dca-1ca1a6592289	e5ffb65a-444d-41a3-8fb2-bcf437b7f704	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:42:07.345	2026-06-22 07:42:07.345
70b03b92-0b10-4a38-8627-ee75fa6b1bbd	05530528-efca-4c8b-a31e-fd121308fa67	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:42:17.905	2026-06-22 07:42:17.905
66f4da53-79ea-4c24-af31-29bc47ad822a	b33ae8a5-41d4-4c7a-ad77-c86fb926100f	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:42:22.803	2026-06-22 07:42:22.803
aea3ebcf-b95b-4154-8ee3-979d075836ec	6cd981e3-f9a7-40e1-9674-791addeec7b6	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:42:30.481	2026-06-22 07:42:30.481
5551b8b4-5eea-4339-bac1-ab2a139a02f3	8e60fd47-28f2-496a-a51b-adb7c410c9a0	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:42:43.283	2026-06-22 07:42:43.283
d77eb284-53d5-4203-8ca6-bcb90dfdc337	31d6221f-37e8-470f-8f83-97748f879e08	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:42:54.067	2026-06-22 07:42:54.067
2af44e33-99cf-4745-b981-cfef3169e403	cf3187cf-305b-4856-9f90-954048f811d1	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:43:01.377	2026-06-22 07:43:01.377
dd47381b-a1ec-49ac-9c4d-5147709e9537	3183ddbc-352b-438b-8c22-4249761c42ab	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:43:08.177	2026-06-22 07:43:08.177
85c6c04f-6dd5-4432-bbd1-7eca10945bc4	1c0e4d6d-6452-41bc-8896-1d166f049f85	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:43:15.604	2026-06-22 07:43:15.604
4cbcf2e5-23a5-42a2-920d-66a4595830a5	ae9ded01-0098-4cb9-bd0f-cc069dd37137	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	NOT_REALLY	2026-06-22 07:43:22.052	2026-06-22 07:43:22.052
d67341bc-f49d-4ee4-8f15-733db31d5f66	bf90bf6a-9d84-4fde-b1ac-12f4ef03ce15	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:43:25.755	2026-06-22 07:43:25.755
46e184c5-ecdd-4f6c-a925-b42a8be77b42	42afe479-4951-46a7-9cd5-7258c1c290b0	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-22 07:43:28.811	2026-06-22 07:43:28.811
af46c2fa-8aac-4cf3-a9b6-5f1c56322fa0	d9fd02c9-b736-4b85-91d7-291e6280d2bc	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	MUST	2026-06-22 07:43:33.041	2026-06-22 07:43:33.041
30d22da8-bcd2-496f-8d54-10607de8dd7e	0c6068cf-52d8-4933-9036-b55a8deb4aec	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-22 07:43:44.13	2026-06-22 07:43:44.13
163fc624-1328-4d98-a58c-ff57e382ae83	700d20d2-5e4d-40dd-b71d-58dca2c994de	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:40:36.32	2026-06-24 16:40:36.32
0cc16ace-b067-4813-83dc-e9bbf7b9111d	b4afe23a-c53c-471e-a3df-6ed9ab42f537	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:41:12.436	2026-06-24 16:41:12.436
a6bf09c7-fcfe-4cec-9a62-cf29bf1be275	6e7439a0-448a-4675-b6d5-888e9a852c82	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:41:28.015	2026-06-24 16:41:28.015
458deafa-7166-44bc-971f-21a804f3ba4c	b8674d13-b180-4d11-ba6d-496592c9588e	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:42:17.576	2026-06-24 16:42:17.576
9317985c-7de3-47f3-a05b-d3af97f376c8	b19eee5b-7704-4f19-b8fe-30f8f198f77f	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:42:39.453	2026-06-24 16:42:39.453
017f5e8a-d9cc-4f32-9264-caa1ddb19c6c	78d7f1a3-0050-4538-8d8a-8a8ff49f8e21	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	IF_OTHERS	2026-06-24 16:43:04.27	2026-06-24 16:43:04.27
c1c17b17-52ea-44b0-9ed4-012aa9651e61	d8e2f4dc-7428-4e96-85b7-8fb6f9b66e6d	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:43:25.015	2026-06-24 16:43:25.015
88bba0d5-86e5-4e55-8692-3c2119cf0d99	c5d56c05-7306-444c-84c5-af3e5171c0f8	b389876f-9a01-4dda-b3a5-6b673a789468	0114313b-35d5-4106-a698-4f0d59c178e5	OK	2026-06-24 16:44:11.198	2026-06-24 16:44:11.198
6b39df0b-ae03-47ba-ad16-1486b1018e69	81130cfa-cc64-49b8-bc6a-76fdde38833f	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-26 14:07:23.36	2026-06-26 14:07:23.36
02e66a08-9994-469c-8b79-7482b2f2ae63	8326f3d0-3a51-4f94-b5c9-a2e1601e2305	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-26 14:07:34.011	2026-06-26 14:08:51.096
b814de12-efa1-477f-9d56-3b3f1b5d9965	c9f0b379-321a-463f-a9df-72a07229e702	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	AGAINST	2026-06-18 10:48:01.376	2026-06-26 14:36:30.033
70e568ae-274c-44b4-9c7e-84075b2d0a20	5e7031a7-372f-446a-99b1-0ad091b523a0	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.375	2026-06-18 14:14:29.739
8232159d-14bb-4001-9bdf-612fbe7d94af	db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	OK	2026-06-18 10:48:01.376	2026-06-18 14:14:29.739
e8bfe473-5250-40b5-be7d-ca6504b83009	9a2137df-d9a2-48a6-80d7-a2b2bee54437	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.748	2026-06-18 14:21:16.783
c9cdc37e-482a-46ac-9a22-47b0ba663695	5e7031a7-372f-446a-99b1-0ad091b523a0	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	OK	2026-06-18 09:17:33.748	2026-06-18 14:21:16.783
83bd7cf6-c60a-4dfc-bf9d-c1ccba6fdc7a	c2cb7318-2e8e-4ea5-ab88-60e54d20a4d7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 13:43:52.768	2026-06-18 14:21:16.784
a099571b-03e9-4e48-8dd0-198ddc672efe	86792acf-021a-408f-a2a5-a3d3be9e996d	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	IF_OTHERS	2026-06-18 09:17:33.747	2026-06-18 15:27:27.576
080fa122-ab13-4b08-a1b6-e11f6c298b6e	d8e2f4dc-7428-4e96-85b7-8fb6f9b66e6d	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:03:03.456	2026-06-22 08:03:03.456
29c05089-b3c3-4363-8495-e859e8c83767	2be2327f-978e-4342-8683-a8bcf5869f5b	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:03:16.039	2026-06-22 08:03:16.039
fe15b384-2da0-439b-ad45-8f5e60e70681	b19eee5b-7704-4f19-b8fe-30f8f198f77f	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:04:21.5	2026-06-22 08:04:21.5
23ce4b6d-d5cc-4192-b3f0-8a703ccdb78e	78d7f1a3-0050-4538-8d8a-8a8ff49f8e21	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:04:47.562	2026-06-22 08:04:47.562
2d30fa4e-45ad-4eaa-b594-d9d6b8d3d97d	c3fee9e5-1d6d-4b04-98d0-587b6dc9b7fe	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:05:17.201	2026-06-22 08:05:17.201
e0e8dd5b-d712-46ab-a84c-d4855ef8577f	c8c5fbe4-8bdb-4e0f-a262-58b78d09916c	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	NOT_REALLY	2026-06-22 08:05:22.388	2026-06-22 08:05:22.388
3bc44935-d678-43e2-bdcd-9c267300017e	f399d00c-ea31-4adc-8143-c338c181b129	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	IF_OTHERS	2026-06-22 08:05:52.946	2026-06-22 08:05:52.946
a0fe52ba-991d-4eeb-bbdf-cd156c7e557e	523986c6-61c8-45f4-a57d-b56106035714	b389876f-9a01-4dda-b3a5-6b673a789468	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	MUST	2026-06-18 10:48:01.376	2026-06-26 14:11:49.583
\.


--
-- Data for Name: PlannerEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlannerEvent" (id, "tripId", "activityId", title, date, "startMinute", "durationMins", color, notes, "createdAt", "updatedAt", "allDay", url, "mapsUrl", cost) FROM stdin;
18d1b0e8-8633-466c-a388-a23eb255f5a9	b389876f-9a01-4dda-b3a5-6b673a789468	74242d01-2ac7-4563-b476-b32be671b660	חדר בריחה – Exit the Room	2026-10-12	1200	75	green	\N	2026-06-18 14:48:41.785	2026-06-18 14:57:17.675	f	\N	https://maps.google.com/?q=Exit+the+Room+Munich+Germany	~€25
d1d01148-a78a-4bc2-83b1-2c955e098786	b389876f-9a01-4dda-b3a5-6b673a789468	ad5161df-9521-454a-ad8c-2466484c18aa	Europa Park	2026-10-08	540	540	green	\N	2026-06-14 14:34:07.249	2026-06-15 06:53:38.88	f	https://www.europapark.de/en	https://maps.app.goo.gl/c1v5fCW2FcNkNiu9A	67€
539ba0bd-2a99-4fb2-b7bc-4f02bd6221ad	b389876f-9a01-4dda-b3a5-6b673a789468	\N	Traumatica Halloween Event	2026-10-09	1140	270	green	\N	2026-06-14 14:06:29.696	2026-06-15 10:46:23.16	f	https://www.europapark.de/en/events/traumatica	\N	51
f8da1630-4020-48cb-96e1-b3c80ed92542	b389876f-9a01-4dda-b3a5-6b673a789468	\N	טיסה	2026-10-07	420	210	blue	\N	2026-06-14 16:11:22.531	2026-06-14 16:31:52.624	f	www.elal.co.il	\N	\N
0b053806-778b-4d5f-be01-09bd5c925159	b389876f-9a01-4dda-b3a5-6b673a789468	\N	מלון	2026-10-11	0	1440	gray	\N	2026-06-15 10:45:29.27	2026-06-15 10:45:29.27	t	\N	\N	\N
291ceefc-1d3e-4ca7-bbf9-5528e039f12d	b389876f-9a01-4dda-b3a5-6b673a789468	fd1177b5-0ef6-4263-903b-11fea4fc0f6f	Rhine Falls – Schaffhausen	2026-10-07	720	150	orange	\N	2026-06-18 14:53:43.41	2026-06-24 13:41:09.078	f	\N	https://maps.google.com/?q=Rhine+Falls+Schaffhausen+Switzerland	~€10
d48b192e-4448-4176-9107-954fc1608dbd	b389876f-9a01-4dda-b3a5-6b673a789468	\N	טיסה	2026-10-14	1200	285	blue	\N	2026-06-14 18:07:40.304	2026-06-14 18:07:45.035	f	www.elal.co.il	\N	\N
51d25773-ad05-41bf-8de0-3ca2a5baf2f2	b389876f-9a01-4dda-b3a5-6b673a789468	86792acf-021a-408f-a2a5-a3d3be9e996d	Ravenna Gorge	2026-10-09	540	240	orange	\N	2026-06-18 14:47:32.429	2026-06-24 13:42:15.3	f	\N	https://maps.google.com/?q=Ravenna+Gorge+Hinterzarten+Germany	חינם
9d3d93bc-a3ab-4493-81c2-1c613b5fd000	b389876f-9a01-4dda-b3a5-6b673a789468	41e4ce1f-02cf-4d3e-a480-cb15071cb605	מגלשת Hasenhorn	2026-10-09	900	120	green	\N	2026-06-18 14:49:07.57	2026-06-18 14:49:09.578	f	\N	https://maps.google.com/?q=Hasenhorn+Coaster+Todtnau+Germany	~€12
fdf0241e-f4bb-4882-9ec9-6fb112821412	b389876f-9a01-4dda-b3a5-6b673a789468	523986c6-61c8-45f4-a57d-b56106035714	קארטינג – Go-Kart Welt	2026-10-13	960	90	green	\N	2026-06-18 14:48:13.137	2026-06-18 14:56:38.074	f	\N	https://maps.google.com/?q=Go+Kart+Welt+Aschheim+Germany	~€30
6ae1e98b-f2f3-420f-bdd9-3407ddfc6e7a	b389876f-9a01-4dda-b3a5-6b673a789468	ab4cb5f8-6da4-4a0f-96fe-efbd7693471a	BMW Welt + Museum	2026-10-13	540	150	blue	\N	2026-06-18 14:49:52.096	2026-06-18 14:56:41.311	f	\N	https://maps.google.com/?q=BMW+Welt+Munich+Germany	חינם
9d64867c-f20c-48af-97a2-3e3db2fa67bf	b389876f-9a01-4dda-b3a5-6b673a789468	5c08bb58-4a5f-429d-872e-8d88fa6ebe54	F1 Simulator	2026-10-13	810	135	green	סגור בימי שני!\n30 דק' = 50€\n45 דק = 70€\n60 דק' = 80€	2026-06-15 10:56:47.146	2026-06-26 13:19:35.422	f	https://www.racing-unleashed.com/lounges/munich	https://maps.app.goo.gl/FMSy4Hr2V8muTubF7	50€
91b03c1f-d2fb-4389-874c-94ec6634d995	b389876f-9a01-4dda-b3a5-6b673a789468	db3da7ba-fe1a-45c3-aba7-d31d4a80ab3a	מפלי Triberg + שעון קוקייה	2026-10-10	540	150	orange	\N	2026-06-18 14:49:36.433	2026-06-18 14:57:04.668	f	\N	https://maps.google.com/?q=Triberg+Waterfalls+Germany	€5
37a3eed8-855c-4444-9dc4-975e1e7314a8	b389876f-9a01-4dda-b3a5-6b673a789468	401a8c4d-93c4-4432-8e3c-a2cf0147204a	Mehliskopf Alpine Coaster	2026-10-10	855	90	green	\N	2026-06-18 14:54:06.111	2026-06-18 14:57:12.423	f	\N	https://maps.google.com/?q=Mehliskopf+Alpine+Coaster+Germany	€4/רידה
\.


--
-- Data for Name: PlannerEventFile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlannerEventFile" (id, "eventId", filename, "originalName", "mimeType", size, "createdAt") FROM stdin;
7cb637c0-b2ee-43f7-b081-4ad757027c41	d1d01148-a78a-4bc2-83b1-2c955e098786	1781506141147-dxxxvy3tkud.png	sagi.png	image/png	1734650	2026-06-15 06:49:01.154
e43ac32e-cd6f-46b5-9f27-c638e76fd5a7	d1d01148-a78a-4bc2-83b1-2c955e098786	1781506256488-e3gce0pn2xq.jpeg	WhatsApp Image 2026-05-15 at 09.51.47.jpeg	image/jpeg	55783	2026-06-15 06:50:56.491
\.


--
-- Data for Name: Trip; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Trip" (id, name, "startDate", "endDate", status, "inviteCode", "createdAt", "defaultCurrency", "ownerId") FROM stdin;
3cd2959c-80b2-4f1e-951e-e40ed83a0327	טיולי	\N	\N	PLAN	c9b44b15-4112-4a69-8fcd-28923f1438f7	2026-06-10 14:09:45.879	ILS	3c208fad-05ef-4082-a6ae-9b01e590851b
b389876f-9a01-4dda-b3a5-6b673a789468	טיול חברים 40	2026-10-07 09:00:00	2026-10-14 09:00:00	PLAN	2d93383f-fcf4-4c9c-ad96-d9b03062ddfb	2026-05-27 14:37:46.914	EUR	d83a4655-e4b7-4412-acac-fd73f17554d6
\.


--
-- Data for Name: TripExpense; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TripExpense" (id, "tripId", "paidByUserId", amount, currency, "exchangeRate", "amountILS", description, category, "createdAt", "expenseDate") FROM stdin;
74248eac-e29f-4554-89c1-b3a491967cf7	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	924.09	EUR	3.3968	3138.95	Sixt	transport	2026-06-21 13:26:45.366	2026-06-21 00:00:00
d3f1ea5d-2a34-48f0-abbe-1f3c23a9f83c	b389876f-9a01-4dda-b3a5-6b673a789468	d83a4655-e4b7-4412-acac-fd73f17554d6	4435.07	ILS	1	4435.07	טיסה	transport	2026-06-21 10:31:48.372	2026-06-21 00:00:00
\.


--
-- Data for Name: TripLink; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TripLink" (id, "tripId", title, description, url, type, status, "providerName", "startDate", "endDate", "estimatedCost", currency, "responsibleUserId", notes, "isPinned", "decisionId", "createdByUserId", "createdAt", "updatedAt", "isPrivate", "fileUrl", "fileName") FROM stdin;
5598a093-b80b-487d-b1c6-817f977623c4	b389876f-9a01-4dda-b3a5-6b673a789468	השכרת רכב SIXT	\N	\N	CAR	SAVED	\N	\N	\N	\N	\N	\N	\N	f	\N	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-21 14:28:35.109	2026-06-21 14:28:35.109	f	/uploads/links/1782052078122-je7dzld5czf.pdf	Sixt-40.pdf
f4ee526d-22ec-457c-966f-84ed758a4094	b389876f-9a01-4dda-b3a5-6b673a789468	טיסות	\N	\N	FLIGHT	SAVED	\N	\N	\N	\N	\N	\N	\N	f	\N	d83a4655-e4b7-4412-acac-fd73f17554d6	2026-06-21 14:29:30.673	2026-06-21 14:29:30.673	t	/uploads/links/1782052157422-0htfh5ztgib.pdf	YENWKZ.pdf
\.


--
-- Data for Name: TripMember; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TripMember" (id, "userId", "tripId", role, "joinedAt") FROM stdin;
d1266d00-2b8c-48aa-b6a9-6c45151ff9b9	63bb1ed9-432c-4638-bad3-50196226451c	b389876f-9a01-4dda-b3a5-6b673a789468	MEMBER	2026-05-27 16:52:40.655
c6267b37-21d2-4183-9fb5-9d9f6ac277d0	fa102463-a816-4a12-945d-cb3d479c694e	b389876f-9a01-4dda-b3a5-6b673a789468	MEMBER	2026-05-27 17:24:55.304
71aa0d7e-90e8-495f-815a-26baa91fa865	9f2ba893-8b53-408d-9cf8-34af77aa7d1e	b389876f-9a01-4dda-b3a5-6b673a789468	MEMBER	2026-05-27 17:41:33.555
d83f7e60-9252-405b-b038-f54d61d9fca8	d83a4655-e4b7-4412-acac-fd73f17554d6	b389876f-9a01-4dda-b3a5-6b673a789468	ADMIN	2026-05-27 14:37:46.914
df2acdf4-1891-41d3-90ad-7fa3db498f9e	0114313b-35d5-4106-a698-4f0d59c178e5	b389876f-9a01-4dda-b3a5-6b673a789468	MEMBER	2026-05-27 14:52:36.167
90ef9cfc-ca42-44be-a54d-8acff4154132	3c208fad-05ef-4082-a6ae-9b01e590851b	3cd2959c-80b2-4f1e-951e-e40ed83a0327	ADMIN	2026-06-10 14:09:45.879
\.


--
-- Data for Name: TripPlace; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TripPlace" (id, "tripId", name, lat, lng, notes, "order", "createdAt", "mapsUrl", date, category) FROM stdin;
2199d928-4762-4d3b-9b5c-75fbbcafa89b	b389876f-9a01-4dda-b3a5-6b673a789468	שדה התעופה באזל-מולהאוז-פרייבורג	47.5972816	7.525895999999999	\N	0	2026-06-21 08:21:32.375	\N	2026-10-07	transport
f9b52c64-43a7-4cfd-9851-da8d5afb1d81	b389876f-9a01-4dda-b3a5-6b673a789468	Belchen	47.8225	7.833055599999999	\N	0	2026-06-21 08:19:34.447	https://maps.google.com/?q=Belchen+Black+Forest+Germany	2026-10-08	nature
bc15f541-ef71-4018-ae53-24e30af0fae9	b389876f-9a01-4dda-b3a5-6b673a789468	Trinkhalle + Lichtenthaler Allee	48.7623	8.2346	פרומנדה מפורסמת + מסדרון מי ריפוי מ-1842 – הלב של עיר הנופש	2	2026-06-22 10:37:35.046	https://maps.google.com/?q=Trinkhalle+Baden-Baden+Germany	2026-10-09	nature
19b077b4-d53c-4300-b47b-024cdc26d275	b389876f-9a01-4dda-b3a5-6b673a789468	הגן האנגלי	48.16423229999999	11.6055522	\N	14	2026-06-21 18:02:44.321	https://maps.google.com/?q=English+Garden+Munich+Germany	2026-10-13	nature
0b893b46-0f65-40b9-9e09-81e0d766f275	b389876f-9a01-4dda-b3a5-6b673a789468	Hasenhorn	47.81944439999999	7.9586111	\N	1	2026-06-21 08:11:57.696	https://maps.google.com/?q=Hasenhorn+Coaster+Todtnau+Germany	2026-10-08	activity
5e28c6ed-1301-4500-bbb7-c79eb12662b7	b389876f-9a01-4dda-b3a5-6b673a789468	Caracalla Therme – ספא תרמי	48.7596	8.2365	מרחצאות תרמיים רומאיים מפוארים – ספא מושלם לאחר יומי הליכות	1	2026-06-22 10:37:35.046	https://maps.google.com/?q=Caracalla+Therme+Baden-Baden+Germany	2026-10-09	activity
3992ebb7-41c6-4ec7-8460-506637b4d851	b389876f-9a01-4dda-b3a5-6b673a789468	עולם ה- BMW	48.1771981	11.5562963	\N	7	2026-06-21 18:01:59.387	https://maps.google.com/?q=BMW+Welt+Munich+Germany	2026-10-13	culture
07e71622-a38e-4f3c-b8f7-5ea0de8f54c1	b389876f-9a01-4dda-b3a5-6b673a789468	Casino Baden-Baden – קזינו מ-1824	48.7602	8.2367	אחד הקזינואות היוקרתיים בעולם – לבוש הולם חובה	3	2026-06-22 10:37:35.046	https://maps.google.com/?q=Casino+Baden-Baden+Germany	2026-10-09	activity
d16c797c-a264-464d-b4d6-7f0aaaef8e6d	b389876f-9a01-4dda-b3a5-6b673a789468	Exit the Room München	48.154897	11.5785377	\N	6	2026-06-21 18:01:56.211	https://maps.google.com/?q=Exit+the+Room+Munich+Germany	2026-10-13	activity
1769eea8-1fcb-43ae-b363-48e33ddb883b	b389876f-9a01-4dda-b3a5-6b673a789468	אליאנץ ארנה	48.2187955	11.6246888	\N	9	2026-06-21 18:02:07.135	https://maps.google.com/?q=Allianz+Arena+Munich+Germany	2026-10-13	activity
0bfd7a26-6edd-4f36-8edf-c8c83d8c4521	b389876f-9a01-4dda-b3a5-6b673a789468	מינכן	48.1351253	11.5819806	\N	11	2026-06-21 18:02:14.959	https://maps.google.com/?q=Race+Experience+Munich+Germany	2026-10-13	activity
023903db-ab09-4d3a-a217-822ae132b498	b389876f-9a01-4dda-b3a5-6b673a789468	מריאנפלאץ	48.1373932	11.5754485	\N	12	2026-06-21 18:02:19.29	https://maps.google.com/?q=Marienplatz+Munich+Germany	2026-10-13	culture
f537c3d3-4cd7-4f5b-a416-d23e892226f9	b389876f-9a01-4dda-b3a5-6b673a789468	Zum Franziskaner	48.1393887	11.5771912	\N	0	2026-06-21 18:00:51.062	https://maps.google.com/?q=Zum+Franziskaner+Munich+Germany	2026-10-13	restaurant
fd6cd134-f17d-434f-8025-11ef0c026fe6	b389876f-9a01-4dda-b3a5-6b673a789468	פטיט פרנס – שטרסבורג	48.5785	7.7421	שכונת תעלות ובתים מחוץ-לעיר מהמאה ה-16 – הכי ציורי בשטרסבורג	1	2026-06-22 10:37:35.046	https://maps.google.com/?q=Petite+France+Strasbourg+France	2026-10-10	culture
9030fd1d-e7ca-49f6-9d60-fb0dd1c2f696	b389876f-9a01-4dda-b3a5-6b673a789468	Merkur Bergbahn – רכבל לפנורמה	48.7738	8.2556	גונדולה לפסגת Merkur (669 מ') עם נוף לכל עמק הריין	4	2026-06-22 10:37:35.046	https://maps.google.com/?q=Merkur+Bergbahn+Baden-Baden+Germany	2026-10-09	nature
70fb5beb-8b5f-4075-b731-f4173e95221c	b389876f-9a01-4dda-b3a5-6b673a789468	מפלי Allerheiligen + חורבות מנזר	48.5664	8.2439	מקום סודי – 7 מפלים ולצדם חורבות מנזר מהמאה ה-12	1	2026-06-22 10:37:35.046	https://maps.google.com/?q=Allerheiligen+Waterfalls+Germany	2026-10-11	nature
b8217865-fb41-4406-8bc5-c6683d85617c	b389876f-9a01-4dda-b3a5-6b673a789468	Rothaus Brauerei – מבשלת הממלכה	47.7948	8.2236	מבשלה ממלכתית גדולה – סיור + בירת Tannenzäpfle טרייה מהמקור	9	2026-06-22 10:37:35.046	https://maps.google.com/?q=Rothaus+Brauerei+Germany	2026-10-08	activity
4b8a52c6-1508-4262-984a-8e5038b43da4	b389876f-9a01-4dda-b3a5-6b673a789468	Therme Erding – ספא המים הגדול בעולם	48.3045	11.9131	29 בריכות + 27 מגלשות – יום ספא מלא בדרך למינכן	16	2026-06-22 10:37:35.046	https://maps.google.com/?q=Therme+Erding+Germany	2026-10-13	activity
f67a8be3-8253-4e94-84a1-ee4d9b7b8863	b389876f-9a01-4dda-b3a5-6b673a789468	מוזיאון כפר פתוח Vogtsbauernhof	48.1575	8.1906	חוות מסורתיות מהמאות ה-16–19 עם הדגמות חיות – תרבות יער שחור אמיתית	2	2026-06-22 10:37:35.046	https://maps.google.com/?q=Vogtsbauernhof+Open+Air+Museum+Gutach	2026-10-11	culture
53ab9d67-0059-4569-82c4-2768ec60112f	b389876f-9a01-4dda-b3a5-6b673a789468	ויסקירכה – כנסיית מורשת UNESCO	47.6819	10.8827	כנסייה בארוקית-רוקוקו מרהיבה – UNESCO 1983. פנים: ציורי תקרה מוזהבים מהממים	2	2026-06-22 10:37:35.046	https://maps.google.com/?q=Wieskirche+Steingaden+Germany	2026-10-12	culture
ac3e4cd5-3e95-49c4-b62e-2aef10270d53	b389876f-9a01-4dda-b3a5-6b673a789468	טירת נוישוונשטיין	47.5576	10.7498	הטירה שהשפיעה על טירת דיסני – הזמינו כרטיסים מראש!	3	2026-06-22 10:37:35.046	https://maps.google.com/?q=Neuschwanstein+Castle+Germany	2026-10-12	culture
e7089b08-2ee7-42d4-955a-7da877510832	b389876f-9a01-4dda-b3a5-6b673a789468	פיסן – עיר עתיקה	47.5714	10.701	עיירה ציורית ממש ליד Neuschwanstein – Hohes Schloss ואוכל מקומי	4	2026-06-22 10:37:35.046	https://maps.google.com/?q=Fussen+Old+Town+Bavaria	2026-10-12	culture
5d0af4af-2e43-4a77-9e07-fcc6ab378804	b389876f-9a01-4dda-b3a5-6b673a789468	קתדרלת שטרסבורג	48.5818	7.7508	קתדרלה גותית מ-1439 – אחת הגבוהות שנבנו אי פעם	0	2026-06-22 10:37:35.046	https://maps.google.com/?q=Strasbourg+Cathedral+France	2026-10-10	culture
40715d2d-3c06-43a9-9d3c-8dd47ec73bb7	b389876f-9a01-4dda-b3a5-6b673a789468	ארמון נימפנבורג	48.1583	11.5033	הארמון הגדול ביותר של בוואריה – גנים בחינם + גלריית היפהפיות	17	2026-06-22 10:37:35.046	https://maps.google.com/?q=Nymphenburg+Palace+Munich+Germany	2026-10-13	culture
a32138cd-9367-449a-a175-e5e3271f2ae3	b389876f-9a01-4dda-b3a5-6b673a789468	Zero Latency Virtual Reality München Neufahrn	48.32947559999999	11.6913854	\N	58	2026-06-26 14:10:19.02	https://share.google/4XC1eIHWNf1tBZUqp	2026-10-13	activity
cf34a66c-f0b8-4544-8d06-5e7dee8a19b3	b389876f-9a01-4dda-b3a5-6b673a789468	פארק אירופה	48.2660194	7.7220076	\N	5	2026-06-14 13:54:18.426	\N	2026-10-08	activity
58c26255-4bf7-4aa3-a7b2-9b6b6561ed88	b389876f-9a01-4dda-b3a5-6b673a789468	Feldberg	47.8589969	8.037044	\N	2	2026-06-21 08:19:23.249	https://maps.google.com/?q=Feldberg+Black+Forest+Germany	2026-10-08	nature
580c08be-9366-49a9-9085-11065057a2a8	b389876f-9a01-4dda-b3a5-6b673a789468	קניון מקסים רוואנה	47.9175824	8.0745554	\N	3	2026-06-21 08:19:16.758	https://maps.google.com/?q=Ravenna+Gorge+Hinterzarten+Germany	2026-10-08	nature
3a58be14-0315-46c1-95ed-45c1ad87c930	b389876f-9a01-4dda-b3a5-6b673a789468	פרייבורג	47.9990077	7.842104299999999	\N	4	2026-06-21 08:19:40.049	https://maps.google.com/?q=Freiburg+im+Breisgau+Germany	2026-10-08	culture
86257b7f-8b2c-4b70-9842-88f13abc070c	b389876f-9a01-4dda-b3a5-6b673a789468	טיטיזה	47.8946026	8.1447897	\N	6	2026-06-21 17:59:45.839	https://maps.google.com/?q=Titisee+Germany	2026-10-08	nature
beea880c-08d1-4ce8-9f56-bbe30fe45c13	b389876f-9a01-4dda-b3a5-6b673a789468	Treetop Walk Black Forest	48.7503584	8.5357728	\N	0	2026-06-21 08:19:30.194	https://maps.app.goo.gl/KSgsYVu8WGmnMKrD8	2026-10-09	nature
eec5f2f2-8762-4c20-aaf0-89dd512f7a33	b389876f-9a01-4dda-b3a5-6b673a789468	מפלי טריברג	48.1283833	8.2301744	\N	0	2026-06-21 08:17:24.448	https://maps.google.com/?q=Triberg+Waterfalls+Germany	2026-10-11	nature
0e8373e1-afda-4220-8986-927bb1d941fc	b389876f-9a01-4dda-b3a5-6b673a789468	Alpine Coaster	47.59633849999999	11.0489385	\N	0	2026-06-21 08:19:44.426	https://maps.google.com/?q=Mehliskopf+Alpine+Coaster+Germany	2026-10-12	activity
bab4c409-6aaa-4274-8142-bf71b060aebe	b389876f-9a01-4dda-b3a5-6b673a789468	מוזיאון המדע	48.1298707	11.5834522	\N	8	2026-06-21 18:02:03.61	https://maps.google.com/?q=Deutsches+Museum+Munich+Germany	2026-10-13	culture
96fb4d1f-13bd-4f83-a180-7d9387df77bc	b389876f-9a01-4dda-b3a5-6b673a789468	CA-BA-LU Bar-Restaurant	48.1395699	11.5891154	\N	3	2026-06-21 18:01:07.42	https://share.google/vC3CfxJgrPLHXsBdT	2026-10-13	restaurant
90aaf98d-0c33-413c-a09e-3946605550b7	b389876f-9a01-4dda-b3a5-6b673a789468	Augustiner Keller Biergarten	48.1437	11.5386	ביירגארטן 5,000 מקומות – בירה מחבית עץ + עוף צלוי קלאסי	20	2026-06-22 10:37:35.046	https://maps.google.com/?q=Augustiner+Keller+Beer+Garden+Munich	2026-10-13	restaurant
04976686-4bfc-4542-9b10-f3e606dd0f98	b389876f-9a01-4dda-b3a5-6b673a789468	Schneider Weisse Tap House	48.1361	11.5797	בירת חיטה הנחשבת ביותר בגרמניה – ישירות מהחבית במרכז העתיק	23	2026-06-22 10:37:35.046	https://maps.google.com/?q=Schneider+Weisse+Tap+House+Munich	2026-10-13	restaurant
178f0789-c5fe-4755-90aa-be95b46792f8	b389876f-9a01-4dda-b3a5-6b673a789468	Augustiner Bräustuben	48.1392299	11.5455912	\N	4	2026-06-21 18:01:13.881	https://maps.google.com/?q=Augustiner+Braustuben+Munich+Germany	2026-10-13	restaurant
d224f435-c6f9-4d5c-9925-f7da34df4e26	b389876f-9a01-4dda-b3a5-6b673a789468	Tantris	48.169796	11.588339	\N	5	2026-06-21 18:01:38.557	https://maps.google.com/?q=Tantris+Munich+Germany	2026-10-13	restaurant
87cd7e80-17b0-4c8b-b868-81efc3adee93	b389876f-9a01-4dda-b3a5-6b673a789468	Paulaner Brewery / Paulaner Brauerei	48.1766087	11.436557	\N	13	2026-06-21 18:02:23.588	https://maps.google.com/?q=Paulaner+Brauerei+Munich+Germany	2026-10-13	restaurant
82c17b22-f861-4708-8a7f-3544146056b7	b389876f-9a01-4dda-b3a5-6b673a789468	Wirtshaus in der Au	48.128	11.5878	מסעדת בוורסט אהובה – Käsespätzle + Schäufele בשכונה אותנטית	24	2026-06-22 10:37:35.046	https://maps.google.com/?q=Wirtshaus+in+der+Au+Munich	2026-10-13	restaurant
f68e47e4-626a-46b9-9e43-80505da2e08a	b389876f-9a01-4dda-b3a5-6b673a789468	Viktualienmarkt	48.1353899	11.5760761	\N	10	2026-06-21 18:02:11.031	https://maps.google.com/?q=Viktualienmarkt+Munich+Germany	2026-10-13	shopping
f2479e86-0635-427d-9c89-dbc76e028703	b389876f-9a01-4dda-b3a5-6b673a789468	TeamSport E-Karting Kart Palast Funpark München	48.23605	11.3511036	\N	56	2026-06-26 14:09:58.014	https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8	2026-10-13	activity
e015d407-782e-4ed5-b955-b85828bc364a	b389876f-9a01-4dda-b3a5-6b673a789468	BattleKart München-Finsing	48.2172259	11.8077385	\N	60	2026-06-26 14:12:10.411	https://maps.app.goo.gl/zQG7zkYq69wH67ya9	2026-10-13	activity
0a9be18b-e231-45b5-9564-c5fc3b13ab35	b389876f-9a01-4dda-b3a5-6b673a789468	Zero Latency Virtual Reality München Neufahrn	48.32947559999999	11.6913854	\N	61	2026-06-26 14:13:01.15	https://share.google/4XC1eIHWNf1tBZUqp	2026-10-13	activity
e9e15c90-8d8d-40eb-bc8e-9691c95d34e3	b389876f-9a01-4dda-b3a5-6b673a789468	TeamSport E-Karting Kart Palast Funpark München	48.23605	11.3511036	\N	59	2026-06-26 14:12:08.683	https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8	2026-10-13	activity
da9abbd8-14f3-4820-9d71-1f05514ee679	b389876f-9a01-4dda-b3a5-6b673a789468	קולמאר – ונציה הקטנה	48.0793	7.3585	הכפר הצבעוני ביותר של אלזס – בתי פסטל, תעלות ויין מקומי	2	2026-06-22 10:37:35.046	https://maps.google.com/?q=Colmar+Alsace+France	2026-10-10	culture
63d28c02-5ca1-436e-8ead-84bef3d809d0	b389876f-9a01-4dda-b3a5-6b673a789468	קייסרסברג – יין ובציר	48.1397	7.2661	כפר אלזסי יפהפה – יקבים פתוחים עם טעימות חינם בעונת הבציר	3	2026-06-22 10:37:35.046	https://maps.google.com/?q=Kaysersberg+Alsace+France	2026-10-10	culture
11b287b9-06d4-493a-8f9e-dbd2b14c8534	b389876f-9a01-4dda-b3a5-6b673a789468	השכרת רכב	47.6243635	7.670722800000001	\N	1	2026-06-21 18:45:23.916	\N	2026-10-07	transport
49f65fd6-ff37-4374-a345-f5f3aca51e39	b389876f-9a01-4dda-b3a5-6b673a789468	נמל התעופה מינכן פרנץ יוזף שטראוס	48.3536407	11.7831852	\N	0	2026-06-21 18:15:37.884	\N	2026-10-14	transport
0ec41656-d268-4d44-a390-25fc79986635	b389876f-9a01-4dda-b3a5-6b673a789468	מפלי הריין	47.6780897	8.6154486	\N	7	2026-06-21 18:00:21.465	https://maps.google.com/?q=Rhine+Falls+Schaffhausen+Switzerland	2026-10-08	nature
63c4aed6-1ef1-4be6-bed4-207e7252dca5	b389876f-9a01-4dda-b3a5-6b673a789468	Eisbachwelle – גלישת גלים בלב מינכן	48.1444	11.5872	גל עומד מלאכותי בנהר Eisbach – גולשים מקצועיים בלב הגן האנגלי, חינם לצפות	22	2026-06-22 10:37:35.046	https://maps.google.com/?q=Eisbachwelle+Munich+Germany	2026-10-13	nature
bbc0b23d-dc1d-4a00-a40a-8c6295cc81c3	b389876f-9a01-4dda-b3a5-6b673a789468	TeamSport E-Karting Kart Palast Funpark München	48.23605	11.3511036	\N	15	2026-06-21 18:13:13.035	\N	2026-10-13	activity
f713ecf2-9160-4fe4-8990-6da720d945e3	b389876f-9a01-4dda-b3a5-6b673a789468	לינדאו	47.55365430000001	9.693054499999999	\N	1	2026-06-21 18:00:17.789	https://maps.google.com/?q=Lindau+Bodensee+Germany	2026-10-12	culture
c6c3e6f5-bcd4-443b-889b-7d5aa7b8c637	b389876f-9a01-4dda-b3a5-6b673a789468	רזידנץ מינכן	48.1402	11.5793	הארמון האורבני הגדול בגרמניה – Schatzkammer עם כתרי מלכים	18	2026-06-22 10:37:35.046	https://maps.google.com/?q=Munich+Residenz+Germany	2026-10-13	culture
e3f54153-8d30-4568-b904-cb6cf9a2651c	b389876f-9a01-4dda-b3a5-6b673a789468	Alte Pinakothek	48.1487	11.5699	מוזיאון אמנות עולמי – Rembrandt, Rubens, Raphael | ימי שלישי: €1	19	2026-06-22 10:37:35.046	https://maps.google.com/?q=Alte+Pinakothek+Munich+Germany	2026-10-13	culture
785659af-b8c7-4006-babb-1c4e6bae7390	b389876f-9a01-4dda-b3a5-6b673a789468	פסל בוואריה + Ruhmeshalle	48.1303	11.5491	טיפוס לתוך הפסל דרך מדרגות פנימיות ותצפית מהעיניים – €4	21	2026-06-22 10:37:35.046	https://maps.google.com/?q=Bavaria+Statue+Munich+Germany	2026-10-13	culture
4b58ac5c-574f-4a38-974a-833b245e4911	b389876f-9a01-4dda-b3a5-6b673a789468	Gästehaus / Freudenstadt – לינת ביניים	48.4534	8.4134	עיירת ריפוי עם כיכר השוק הגדולה ביותר בגרמניה	3	2026-06-22 10:37:35.046	https://maps.google.com/?q=Freudenstadt+Germany	2026-10-11	hotel
e08e05e3-b8c7-44fc-a78c-4b6ae3b9254b	b389876f-9a01-4dda-b3a5-6b673a789468	Black Forest Burger, Restaurant	47.6230646	8.2138507	\N	8	2026-06-21 18:00:32.686	https://share.google/zawQ36BfPg0aPJbkX	2026-10-08	restaurant
d093175a-3862-48ed-a861-1ec9f3b946f8	b389876f-9a01-4dda-b3a5-6b673a789468	60 Secondi Pizza Napoletana	48.1621895	11.5896205	\N	1	2026-06-21 18:00:35.085	https://share.google/2O8Yo6hnI0bMxhdpq	2026-10-13	restaurant
6cf97c85-337d-4f7f-984f-0554cfff827a	b389876f-9a01-4dda-b3a5-6b673a789468	הופבראוהאוס	48.13763729999999	11.5797494	\N	2	2026-06-21 18:00:38.777	https://maps.google.com/?q=Hofbrauhaus+Munich+Germany	2026-10-13	restaurant
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, "passwordHash", "createdAt", "avatarUrl") FROM stdin;
63bb1ed9-432c-4638-bad3-50196226451c	אבירם	aviram274@gmail.com	$2b$10$1Otwrar431mz51xDCiwchudt6FlyxkpgWajvp6OL8had3sSVxtuSC	2026-05-27 16:51:51.028	\N
fa102463-a816-4a12-945d-cb3d479c694e	גיא	guyshahar3@walla.co.il	$2b$10$kGK1E5xO0vJZXW7qhfEtOOa5dV54nDCrBi5MPifDvOCz0SknxPnC6	2026-05-27 17:24:32.991	\N
9f2ba893-8b53-408d-9cf8-34af77aa7d1e	עידן	idansabov@gmail.com	$2b$10$K3WFX0csHGkQ0L1oqi1KyuVgIddpRObmB400MbJSL0BO8WxhK/lWO	2026-05-27 17:39:27.887	\N
d83a4655-e4b7-4412-acac-fd73f17554d6	דור	dorfbl@gmail.com	$2b$10$UBshal2K7VR72jlv.O0mAeKyp.4v2v0S7Ydb16pryDuKxnhGvs49q	2026-05-27 14:34:16.528	/uploads/avatars/1779974421042-q206wexnme.png
0114313b-35d5-4106-a698-4f0d59c178e5	יואב	yoav.faigen@gmail.com	$2b$10$vTVtjulIeKH/W7iKo/DKo.xxg6ha2/4mVfO1N0wQTvPkcotG4CntW	2026-05-27 14:51:55.993	/uploads/avatars/1780309850697-u5jza1rx6r.jpg
3c208fad-05ef-4082-a6ae-9b01e590851b	דור 2	dor@feibel.co.il	$2b$10$gYPyie0.eBz5Y3OoZqdXFufa1uw3g/Va6EMBn0QunoZ9TdEF6qas.	2026-06-10 13:57:02.119	/uploads/avatars/1781100565175-2o9zycthgnr.jpg
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
fa8fdd52-6a92-4c2e-9465-54ce24a7ed85	a78903caf098e64b9d119050f6dd7a174d3f1024992dd6f9f7f2ffa8841ccc11	2026-05-27 14:57:47.417706+03	20260527115747_init	\N	\N	2026-05-27 14:57:47.388242+03	1
75108149-6c14-4f42-bc6b-a5fc444e1861	c13a078ca1de0f88187c5b9ba7cf5fd6e80aa26e718111c753999c2f7a654c13	2026-05-28 10:06:44.68779+03	20260528070644_add_expenses	\N	\N	2026-05-28 10:06:44.669478+03	1
c501b4d2-865c-4e38-a2b2-578ab3948229	d00c6f88f943661c027ef012ef3c8b8cebb9ebcaab4ce73d1f5be8b34275e922	2026-06-01 19:34:23.397826+03	20260601170000_add_trip_links	\N	\N	2026-06-01 19:34:23.386327+03	1
353adf84-04d9-4eff-86fa-ef92cd59e784	122cfd98a90416f45c83ba81862222d3bdfe67032995440e8c414b271868f226	2026-05-28 13:36:04.762627+03	20260528103604_add_avatar_url	\N	\N	2026-05-28 13:36:04.757783+03	1
84ca4873-5600-4593-996e-640c9b69384f	19afb529e401b5b91e699a2032299ad1148ca8468a656ed704aaf07ee99fbcab	2026-05-28 14:11:48.861693+03	20260528111148_add_expense_date	\N	\N	2026-05-28 14:11:48.858958+03	1
eb6e2dff-0e83-4e0a-9449-79fd12fe2621	d902dbb38e75d00eba55a9b959e9251b47229421c61d03b3ea138df88ef3fcb0	2026-06-02 08:46:40.239209+03	20260601210000_triplink_private_file	\N	\N	2026-06-02 08:46:40.235535+03	1
09ebe3f9-f71a-4c85-a44b-a14d37b600ee	7389590b44c46deac06ad84c5d1740f89a35d25b4a4602e175f07b2f057721e4	2026-05-28 16:31:51.437939+03	20260528133151_add_trip_places	\N	\N	2026-05-28 16:31:51.426982+03	1
7de2ead7-9355-437c-96df-feeab514f3d3	6bfe389d9e1678028fddea0545e7b69ba1c13acd9ed050508dcfce74e82c190b	\N	20260601200000_remove_open_status	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260601200000_remove_open_status\n\nDatabase error code: 42804\n\nDatabase error:\nERROR: default for column "status" cannot be cast automatically to type "DecisionStatus"\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42804), message: "default for column \\"status\\" cannot be cast automatically to type \\"DecisionStatus\\"", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(12831), routine: Some("ATExecAlterColumnType") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260601200000_remove_open_status"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260601200000_remove_open_status"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2026-06-02 08:37:28.616184+03	2026-06-02 08:37:17.102229+03	0
22d16f17-ee8b-4780-8d58-0a27a3c42543	23015c5d7815084c7f51e5b9a111806dccfbcf6eed47eca7c7c23a2d4de16065	2026-06-01 13:18:07.766099+03	20260601101807_add_trip_default_currency	\N	\N	2026-06-01 13:18:07.757847+03	1
d8017457-aee1-413d-b722-ac6c4b48fc28	88faf6d269a45c28ba7fa5a82669676d4f1ccbf090b3291ab820fd1671d1b913	2026-06-01 18:15:13.719731+03	20260601151513_add_decisions	\N	\N	2026-06-01 18:15:13.688807+03	1
5e80765f-cc9b-40fa-8e08-ae5b26cf1297	9a2e982068e100d4aa39d562bc894edb749a39a49e7ff6cf2a491721157b169b	\N	20260601160000_decisions_multi_choice	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260601160000_decisions_multi_choice\n\nDatabase error code: 22P02\n\nDatabase error:\nERROR: invalid input value for enum "DecisionType_new": "MANUAL"\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E22P02), message: "invalid input value for enum \\"DecisionType_new\\": \\"MANUAL\\"", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("enum.c"), line: Some(129), routine: Some("enum_in") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260601160000_decisions_multi_choice"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260601160000_decisions_multi_choice"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2026-06-01 18:30:31.756807+03	2026-06-01 18:30:07.992216+03	0
5b5425fb-e9e8-4685-b891-1d103c53c93b	47c9abd8c2ad5d15f505cde75deefb7d46a5013e72103bca2c2e5417f197417d	2026-06-02 08:37:42.233885+03	20260601200000_remove_open_status	\N	\N	2026-06-02 08:37:42.227176+03	1
032d005e-58b2-423e-9961-944c2f73ce54	269427a4231be46dda0b334812ea8951ea9bff6c9d53435bf899abe8e9042d4a	2026-06-01 18:30:42.45614+03	20260601160000_decisions_multi_choice	\N	\N	2026-06-01 18:30:42.442904+03	1
29821242-2c2d-4f9b-ac3b-9a798204952e	41ca6f45725b80e1e44951c5e1ff706da9568781e0d4de7bc5b676c9fdc49c6f	2026-06-07 14:10:36.077884+03	20260607100000_trip_status_v2	\N	\N	2026-06-07 14:10:36.071265+03	1
813bf095-89e7-460f-8184-6a3570c7c083	71b592fddbad5636ada15d75f340d97ae920a120107a3de6f70816a1c80fe4b6	2026-06-02 14:00:58.779941+03	20260602000000_decision_secret_vote	\N	\N	2026-06-02 14:00:58.775946+03	1
74db01bb-53a0-4853-9662-1938a8071b6f	ae0e5ef31f60ffecff8aeb863a4521548909cc263a7e2067c501ebac9ca34468	2026-06-03 09:56:59.744108+03	20260602100000_decision_top3	\N	\N	2026-06-03 09:56:59.7409+03	1
65a04dae-6b37-41be-9811-0545975cc315	2abe4db497ce9afdde562f320fefbf4e49e21813f55a8c63c2cfae5677c78249	2026-06-07 14:06:13.216359+03	20260607000000_remove_questionnaire_destinations	\N	\N	2026-06-07 14:06:13.208965+03	1
8468368e-5b9a-46d4-a3b1-3f6962fbd447	a1ef2388a2e3c1bb59884fdcae462ddb7ea0a77c87c1babb4b90fb4c70c9936f	2026-06-07 16:24:31.210025+03	20260607200000_trip_owner	\N	\N	2026-06-07 16:24:31.201517+03	1
63b303ba-2f1d-4833-b214-4e9178de9a54	aa84fa2a558f26033ac66eff76273f7442ed0def76f3795600bce3f4e4e6cbf8	2026-06-14 17:00:31.233513+03	20260614000000_planner	\N	\N	2026-06-14 17:00:31.219038+03	1
794a84c3-bbfd-442d-b4e2-f1b03b967c13	b3de4c0ecf0c443480e279c647a89d5f56e3d1fd0679060a7eafa76fee3c9396	2026-06-13 10:04:40.10311+03	20260613000000_decision_hide_results	\N	\N	2026-06-13 10:04:40.094371+03	1
d0f7b46d-8701-4c69-b95f-92661e6d5475	c2f61b8657f0e2498d38b5ec37ebf20dfcd3b69ce59dd434c166ba0e742f6c83	2026-06-14 18:41:09.434947+03	20260614200000_planner_event_v2	\N	\N	2026-06-14 18:41:09.431982+03	1
a95b04a5-6184-4392-b283-ddb0dda38894	2f331cadc48074dac7517166e42f31967b34c1d12b63afa3ef506dba60372c3e	2026-06-14 19:30:04.155879+03	20260614300000_planner_activity_v2	\N	\N	2026-06-14 19:30:04.147216+03	1
01d338c5-bac3-45dd-8dd2-e5706cdccc3d	faca356acab96ca77937b895041f45773e08cfebfe8150d5963c2dfbc2cca7b3	2026-06-14 19:40:30.901285+03	20260614400000_planner_event_v3	\N	\N	2026-06-14 19:40:30.892209+03	1
dd6fefe6-4373-4ad2-816a-bcd22f968103	036cbeb64e424909babe66db5004941012575e7e5db08345ec132133d62d66a2	2026-06-15 09:45:59.299976+03	20260614500000_planner_event_cost	\N	\N	2026-06-15 09:45:59.297334+03	1
40c792f6-dfe3-4398-9c19-00b0eaef23e3	a5a9b408b4c09b5f38fdf2bbcbf97f45df931929f6ac49b104aabd495d5d3da4	2026-06-18 09:52:09.991768+03	20260615000000_planner_activity_vote	\N	\N	2026-06-18 09:52:09.983337+03	1
1853ffe2-448c-4a44-a2f0-c1dea3d2e4df	dc2e586892d77b88c2557bc1ab140841dc372e4ddeeb3c5e88eb901adcf5989e	2026-06-21 09:22:03.917935+03	20260620000000_place_maps_url	\N	\N	2026-06-21 09:22:03.914939+03	1
23fba3a0-b804-41f8-8537-2806e3476d22	98ff8afe04de2486226ec11d4925ef6b913c1232d98521cb85560b0a6a1df565	2026-06-21 11:31:52.575421+03	20260621000000_place_date	\N	\N	2026-06-21 11:31:52.572254+03	1
\.


--
-- Name: DecisionOption DecisionOption_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionOption"
    ADD CONSTRAINT "DecisionOption_pkey" PRIMARY KEY (id);


--
-- Name: DecisionVote DecisionVote_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionVote"
    ADD CONSTRAINT "DecisionVote_pkey" PRIMARY KEY (id);


--
-- Name: Decision Decision_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Decision"
    ADD CONSTRAINT "Decision_pkey" PRIMARY KEY (id);


--
-- Name: ExpenseParticipant ExpenseParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExpenseParticipant"
    ADD CONSTRAINT "ExpenseParticipant_pkey" PRIMARY KEY (id);


--
-- Name: PlacePhoto PlacePhoto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlacePhoto"
    ADD CONSTRAINT "PlacePhoto_pkey" PRIMARY KEY (id);


--
-- Name: PlannerActivityFile PlannerActivityFile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivityFile"
    ADD CONSTRAINT "PlannerActivityFile_pkey" PRIMARY KEY (id);


--
-- Name: PlannerActivityVote PlannerActivityVote_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivityVote"
    ADD CONSTRAINT "PlannerActivityVote_pkey" PRIMARY KEY (id);


--
-- Name: PlannerActivity PlannerActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivity"
    ADD CONSTRAINT "PlannerActivity_pkey" PRIMARY KEY (id);


--
-- Name: PlannerEventFile PlannerEventFile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerEventFile"
    ADD CONSTRAINT "PlannerEventFile_pkey" PRIMARY KEY (id);


--
-- Name: PlannerEvent PlannerEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerEvent"
    ADD CONSTRAINT "PlannerEvent_pkey" PRIMARY KEY (id);


--
-- Name: TripExpense TripExpense_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripExpense"
    ADD CONSTRAINT "TripExpense_pkey" PRIMARY KEY (id);


--
-- Name: TripLink TripLink_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripLink"
    ADD CONSTRAINT "TripLink_pkey" PRIMARY KEY (id);


--
-- Name: TripMember TripMember_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripMember"
    ADD CONSTRAINT "TripMember_pkey" PRIMARY KEY (id);


--
-- Name: TripPlace TripPlace_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripPlace"
    ADD CONSTRAINT "TripPlace_pkey" PRIMARY KEY (id);


--
-- Name: Trip Trip_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trip"
    ADD CONSTRAINT "Trip_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: DecisionVote_decisionId_optionId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DecisionVote_decisionId_optionId_userId_key" ON public."DecisionVote" USING btree ("decisionId", "optionId", "userId");


--
-- Name: ExpenseParticipant_expenseId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ExpenseParticipant_expenseId_userId_key" ON public."ExpenseParticipant" USING btree ("expenseId", "userId");


--
-- Name: PlannerActivityVote_activityId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PlannerActivityVote_activityId_userId_key" ON public."PlannerActivityVote" USING btree ("activityId", "userId");


--
-- Name: PlannerActivityVote_tripId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PlannerActivityVote_tripId_idx" ON public."PlannerActivityVote" USING btree ("tripId");


--
-- Name: TripMember_userId_tripId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TripMember_userId_tripId_key" ON public."TripMember" USING btree ("userId", "tripId");


--
-- Name: Trip_inviteCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Trip_inviteCode_key" ON public."Trip" USING btree ("inviteCode");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: DecisionOption DecisionOption_decisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionOption"
    ADD CONSTRAINT "DecisionOption_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES public."Decision"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DecisionVote DecisionVote_decisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionVote"
    ADD CONSTRAINT "DecisionVote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES public."Decision"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DecisionVote DecisionVote_optionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionVote"
    ADD CONSTRAINT "DecisionVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES public."DecisionOption"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DecisionVote DecisionVote_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DecisionVote"
    ADD CONSTRAINT "DecisionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Decision Decision_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Decision"
    ADD CONSTRAINT "Decision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Decision Decision_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Decision"
    ADD CONSTRAINT "Decision_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExpenseParticipant ExpenseParticipant_expenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExpenseParticipant"
    ADD CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES public."TripExpense"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExpenseParticipant ExpenseParticipant_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExpenseParticipant"
    ADD CONSTRAINT "ExpenseParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PlacePhoto PlacePhoto_placeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlacePhoto"
    ADD CONSTRAINT "PlacePhoto_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES public."TripPlace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlannerActivityFile PlannerActivityFile_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivityFile"
    ADD CONSTRAINT "PlannerActivityFile_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."PlannerActivity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlannerActivityVote PlannerActivityVote_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivityVote"
    ADD CONSTRAINT "PlannerActivityVote_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."PlannerActivity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlannerActivity PlannerActivity_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerActivity"
    ADD CONSTRAINT "PlannerActivity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlannerEventFile PlannerEventFile_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerEventFile"
    ADD CONSTRAINT "PlannerEventFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public."PlannerEvent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlannerEvent PlannerEvent_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerEvent"
    ADD CONSTRAINT "PlannerEvent_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."PlannerActivity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PlannerEvent PlannerEvent_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlannerEvent"
    ADD CONSTRAINT "PlannerEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TripExpense TripExpense_paidByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripExpense"
    ADD CONSTRAINT "TripExpense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TripExpense TripExpense_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripExpense"
    ADD CONSTRAINT "TripExpense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TripLink TripLink_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripLink"
    ADD CONSTRAINT "TripLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TripLink TripLink_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripLink"
    ADD CONSTRAINT "TripLink_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TripMember TripMember_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripMember"
    ADD CONSTRAINT "TripMember_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TripMember TripMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripMember"
    ADD CONSTRAINT "TripMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TripPlace TripPlace_tripId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TripPlace"
    ADD CONSTRAINT "TripPlace_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES public."Trip"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: azure_pg_admin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- Name: FUNCTION pg_replication_origin_advance(text, pg_lsn); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_advance(text, pg_lsn) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_create(text); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_create(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_drop(text); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_drop(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_oid(text); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_oid(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_progress(text, boolean); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_progress(text, boolean) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_is_setup(); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_is_setup() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_progress(boolean); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_progress(boolean) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_reset(); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_setup(text); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_setup(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_xact_reset(); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_xact_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_xact_setup(pg_lsn, timestamp with time zone); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_xact_setup(pg_lsn, timestamp with time zone) TO azure_pg_admin;


--
-- Name: FUNCTION pg_show_replication_origin_status(OUT local_id oid, OUT external_id text, OUT remote_lsn pg_lsn, OUT local_lsn pg_lsn); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_show_replication_origin_status(OUT local_id oid, OUT external_id text, OUT remote_lsn pg_lsn, OUT local_lsn pg_lsn) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset(); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_shared(text); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_shared(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_single_function_counters(oid); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_single_function_counters(oid) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_single_table_counters(oid); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_single_table_counters(oid) TO azure_pg_admin;


--
-- Name: COLUMN pg_config.name; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(name) ON TABLE pg_catalog.pg_config TO azure_pg_admin;


--
-- Name: COLUMN pg_config.setting; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(setting) ON TABLE pg_catalog.pg_config TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.line_number; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(line_number) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.type; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(type) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.database; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(database) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.user_name; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(user_name) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.address; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(address) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.netmask; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(netmask) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.auth_method; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(auth_method) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.options; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(options) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.error; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(error) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.local_id; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(local_id) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.external_id; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(external_id) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.remote_lsn; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(remote_lsn) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.local_lsn; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(local_lsn) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.name; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(name) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.off; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(off) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.size; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(size) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.allocated_size; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(allocated_size) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.starelid; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(starelid) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staattnum; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staattnum) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stainherit; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stainherit) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanullfrac; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanullfrac) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stawidth; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stawidth) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stadistinct; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stadistinct) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind1; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stakind1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind2; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stakind2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind3; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stakind3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind4; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stakind4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind5; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stakind5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop1; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staop1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop2; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staop2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop3; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staop3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop4; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staop4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop5; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(staop5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll1; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stacoll1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll2; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stacoll2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll3; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stacoll3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll4; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stacoll4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll5; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stacoll5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers1; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanumbers1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers2; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanumbers2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers3; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanumbers3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers4; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanumbers4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers5; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stanumbers5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues1; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stavalues1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues2; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stavalues2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues3; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stavalues3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues4; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stavalues4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues5; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(stavalues5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.oid; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(oid) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subdbid; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subdbid) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subname; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subname) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subowner; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subowner) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subenabled; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subenabled) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subconninfo; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subconninfo) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subslotname; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subslotname) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subsynccommit; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subsynccommit) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subpublications; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT(subpublications) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- PostgreSQL database dump complete
--

