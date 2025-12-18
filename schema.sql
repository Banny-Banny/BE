--
-- Cleaned dump (removed psql meta commands)

-- Dumped from database version 14.20 (Homebrew)
-- Dumped by pg_dump version 14.20 (Homebrew)

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
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: capsules_media_types_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.capsules_media_types_enum AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO',
    'AUDIO',
    'MUSIC'
);


ALTER TYPE public.capsules_media_types_enum OWNER TO postgres;

--
-- Name: friendships_status_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.friendships_status_enum AS ENUM (
    'PENDING',
    'CONNECTED',
    'BLOCKED'
);


ALTER TYPE public.friendships_status_enum OWNER TO postgres;

--
-- Name: media_type_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.media_type_enum AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO',
    'AUDIO',
    'MUSIC'
);


ALTER TYPE public.media_type_enum OWNER TO postgres;

--
-- Name: orders_status_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.orders_status_enum AS ENUM (
    'PENDING',
    'PENDING_PAYMENT',
    'PAID',
    'CANCELED',
    'FAILED'
);


ALTER TYPE public.orders_status_enum OWNER TO postgres;

--
-- Name: orders_time_option_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.orders_time_option_enum AS ENUM (
    '1_WEEK',
    '1_MONTH',
    '1_YEAR',
    'CUSTOM'
);


ALTER TYPE public.orders_time_option_enum OWNER TO postgres;

--
-- Name: payments_status_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.payments_status_enum AS ENUM (
    'READY',
    'PAID',
    'CANCELED',
    'FAILED'
);


ALTER TYPE public.payments_status_enum OWNER TO postgres;

--
-- Name: products_media_types_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.products_media_types_enum AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO',
    'AUDIO',
    'MUSIC'
);


ALTER TYPE public.products_media_types_enum OWNER TO postgres;

--
-- Name: products_product_type_enum; Type: TYPE; Schema: public; Owner: kimdongeun
--

CREATE TYPE public.products_product_type_enum AS ENUM (
    'EASTER_EGG',
    'TIME_CAPSULE'
);


ALTER TYPE public.products_product_type_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: capsule_access_logs; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.capsule_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capsule_id uuid NOT NULL,
    viewer_id uuid NOT NULL,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.capsule_access_logs OWNER TO postgres;

--
-- Name: capsules; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.capsules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid,
    latitude numeric(10,8),
    longitude numeric(11,8),
    open_at timestamp without time zone,
    is_locked boolean DEFAULT true NOT NULL,
    view_limit integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    media_urls text[],
    media_types public.capsules_media_types_enum[],
    content character varying(500),
    media_item_ids uuid[],
    text_blocks jsonb,
    title character varying(100) NOT NULL,
    CONSTRAINT "CHK_f7e1c3066476cc63c23c4d6d75" CHECK ((((media_urls IS NULL) OR (array_length(media_urls, 1) <= 3)) AND ((media_types IS NULL) OR (array_length(media_types, 1) <= 3))))
);


ALTER TABLE public.capsules OWNER TO postgres;

--
-- Name: COLUMN capsules.user_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.user_id IS '작성자(Owner)';


--
-- Name: COLUMN capsules.product_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.product_id IS '유료 스킨/기능 사용 시 연결, 무료면 NULL';


--
-- Name: COLUMN capsules.latitude; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.latitude IS '위도: 소수점 8자리로 cm 단위 정밀도 보장';


--
-- Name: COLUMN capsules.longitude; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.longitude IS '경도: 소수점 8자리로 cm 단위 정밀도 보장';


--
-- Name: COLUMN capsules.open_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.open_at IS '개봉 예정일. 이 시간이 지나야 is_locked 해제 가능';


--
-- Name: COLUMN capsules.is_locked; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.is_locked IS 'App 표시용 플래그. open_at 비교 후 서버에서 업데이트';


--
-- Name: COLUMN capsules.view_limit; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.view_limit IS '선착순 인원 제한 (이스터에그용). 0이면 무제한';


--
-- Name: COLUMN capsules.view_count; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.view_count IS '현재까지 열람한 인원 수. view_limit 도달 시 마감';


--
-- Name: COLUMN capsules.deleted_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.deleted_at IS '사용자가 삭제했거나, 선착순 마감되어 지도에서 사라진 시점';


--
-- Name: COLUMN capsules.media_urls; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.media_urls IS '업로드된 파일의 CDN/S3 경로 목록 (최대 3개, nullable entries 허용)';


--
-- Name: COLUMN capsules.media_types; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.media_types IS '저장된 미디어의 종류 목록 (최대 3개, TEXT/IMAGE/VIDEO/MUSIC)';


--
-- Name: COLUMN capsules.content; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.content IS '사용자가 작성한 메시지';


--
-- Name: COLUMN capsules.media_item_ids; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.media_item_ids IS 'Media 엔티티 id 목록 (presign/complete 이후 캡슐에 연결)';


--
-- Name: COLUMN capsules.text_blocks; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.capsules.text_blocks IS '텍스트 블록 배열 { order, content }';


--
-- Name: customer_services; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.customer_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    admin_reply text,
    is_resolved boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_services OWNER TO postgres;

--
-- Name: COLUMN customer_services.admin_reply; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.customer_services.admin_reply IS '관리자 페이지에서 작성한 답변';


--
-- Name: COLUMN customer_services.is_resolved; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.customer_services.is_resolved IS '처리 완료 여부';


--
-- Name: COLUMN customer_services.updated_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.customer_services.updated_at IS '답변 작성 또는 수정 시간';


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    status public.friendships_status_enum DEFAULT 'PENDING'::public.friendships_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.friendships OWNER TO postgres;

--
-- Name: COLUMN friendships.user_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.friendships.user_id IS '요청자';


--
-- Name: COLUMN friendships.friend_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.friendships.friend_id IS '대상자';


--
-- Name: COLUMN friendships.status; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.friendships.status IS '현재 관계 상태';


--
-- Name: COLUMN friendships.updated_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.friendships.updated_at IS '상태 변경(수락/차단) 일시';


--
-- Name: media; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    object_key character varying(300) NOT NULL,
    type public.media_type_enum NOT NULL,
    content_type character varying(100) NOT NULL,
    size bigint NOT NULL,
    duration_ms integer,
    width integer,
    height integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    total_amount integer NOT NULL,
    status public.orders_status_enum DEFAULT 'PENDING_PAYMENT'::public.orders_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    time_option public.orders_time_option_enum NOT NULL,
    custom_open_at timestamp without time zone,
    headcount integer NOT NULL,
    photo_count integer DEFAULT 0 NOT NULL,
    add_music boolean DEFAULT false NOT NULL,
    add_video boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: COLUMN orders.total_amount; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.total_amount IS '할인 등이 적용된 최종 결제 금액';


--
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.status IS '결제 프로세스 상태';


--
-- Name: COLUMN orders.time_option; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.time_option IS '열람 시점 옵션';


--
-- Name: COLUMN orders.custom_open_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.custom_open_at IS 'CUSTOM 옵션일 때 지정 시각';


--
-- Name: COLUMN orders.headcount; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.headcount IS '인원수 (1~10)';


--
-- Name: COLUMN orders.photo_count; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.orders.photo_count IS '총 사진 장수 (장당 500원, 총합 ≤ headcount*5)';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    pg_tid character varying(100) NOT NULL,
    amount integer NOT NULL,
    status public.payments_status_enum DEFAULT 'READY'::public.payments_status_enum NOT NULL,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    pg_raw jsonb
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: COLUMN payments.order_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.payments.order_id IS '1:1 관계. 하나의 주문에는 하나의 결제 건만 존재';


--
-- Name: COLUMN payments.pg_tid; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.payments.pg_tid IS 'PG사(카카오페이)에서 발급한 고유 거래번호';


--
-- Name: COLUMN payments.amount; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.payments.amount IS '실제 승인된 금액';


--
-- Name: COLUMN payments.approved_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.payments.approved_at IS '결제 승인 일시';


--
-- Name: COLUMN payments.pg_raw; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.payments.pg_raw IS 'PG 응답 원문 (준비/승인)';


--
-- Name: products; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    price integer NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    product_type public.products_product_type_enum DEFAULT 'TIME_CAPSULE'::public.products_product_type_enum NOT NULL,
    media_types public.products_media_types_enum[],
    max_media_count integer,
    CONSTRAINT "CHK_1ed530bd5f41fc1ea001b75af8" CHECK (((product_type <> 'EASTER_EGG'::public.products_product_type_enum) OR ((max_media_count IS NOT NULL) AND ((max_media_count >= 0) AND (max_media_count <= 3)))))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: COLUMN products.name; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.name IS '상품명 (예: 100년 타임캡슐)';


--
-- Name: COLUMN products.price; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.price IS '판매 가격 (0원이면 무료 아이템)';


--
-- Name: COLUMN products.description; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.description IS '상품 상세 설명';


--
-- Name: COLUMN products.is_active; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.is_active IS 'True: 노출중, False: 비노출';


--
-- Name: COLUMN products.product_type; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.product_type IS '상품 유형: EASTER_EGG(제약 적용), TIME_CAPSULE(제약 없음)';


--
-- Name: COLUMN products.media_types; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.media_types IS '이 상품으로 허용되는 미디어 타입 목록 (이스터에그 전용, 최대 3개 업로드 지원)';


--
-- Name: COLUMN products.max_media_count; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.products.max_media_count IS '업로드 가능한 미디어 최대 개수 (이스터에그: 최대 3개, 타임캡슐: null 허용)';


--
-- Name: users; Type: TABLE; Schema: public; Owner: kimdongeun
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nickname character varying(50) NOT NULL,
    phone_number character varying(20) NOT NULL,
    email character varying(100),
    profile_img character varying(500),
    kakao_id character varying(100),
    is_marketing_agreed boolean DEFAULT false NOT NULL,
    is_push_agreed boolean DEFAULT true NOT NULL,
    is_location_term_agreed boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    provider character varying(20) DEFAULT 'LOCAL'::character varying NOT NULL,
    egg_slots integer DEFAULT 3 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.id IS '외부 유출 방지를 위한 랜덤 고유 ID';


--
-- Name: COLUMN users.nickname; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.nickname IS '앱 내 표시되는 이름';


--
-- Name: COLUMN users.phone_number; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.phone_number IS '친구 추천 및 중복 가입 방지';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.email IS '계정 복구 및 알림용';


--
-- Name: COLUMN users.profile_img; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.profile_img IS 'S3 이미지 URL';


--
-- Name: COLUMN users.kakao_id; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.kakao_id IS '카카오 소셜로그인 ID';


--
-- Name: COLUMN users.is_marketing_agreed; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.is_marketing_agreed IS '마케팅 정보 수신 동의';


--
-- Name: COLUMN users.is_push_agreed; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.is_push_agreed IS '앱 푸시 알림 수신 동의';


--
-- Name: COLUMN users.is_location_term_agreed; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.is_location_term_agreed IS '위치기반 서비스 이용약관 동의';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.is_active IS 'True: 활동중, False: 탈퇴/정지';


--
-- Name: COLUMN users.deleted_at; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.deleted_at IS 'Soft Delete';


--
-- Name: COLUMN users.provider; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.provider IS 'KAKAO, GOOGLE, APPLE, LOCAL 등 인증 제공자 구분';


--
-- Name: COLUMN users.egg_slots; Type: COMMENT; Schema: public; Owner: kimdongeun
--

COMMENT ON COLUMN public.users.egg_slots IS '사용자가 보유한 이스터에그 작성 가능 슬롯 (기본 3, 생성 시 1 소모). view_limit 소진 시 1개 회복.';


--
-- Name: products PK_0806c755e0aca124e67c0cf6d7d; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);


--
-- Name: friendships PK_08af97d0be72942681757f07bc8; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT "PK_08af97d0be72942681757f07bc8" PRIMARY KEY (id);


--
-- Name: payments PK_197ab7af18c93fbb0c9b28b4a59; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY (id);


--
-- Name: capsules PK_1d1ddb399b2630cf64f197d98da; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsules
    ADD CONSTRAINT "PK_1d1ddb399b2630cf64f197d98da" PRIMARY KEY (id);


--
-- Name: customer_services PK_56089dcf272f4aca67b6ce27a8b; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "PK_56089dcf272f4aca67b6ce27a8b" PRIMARY KEY (id);


--
-- Name: orders PK_710e2d4957aa5878dfe94e4ac2f; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: capsule_access_logs PK_dd8b1e1518da4b409b4becb4c42; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsule_access_logs
    ADD CONSTRAINT "PK_dd8b1e1518da4b409b4becb4c42" PRIMARY KEY (id);


--
-- Name: media PK_f4e0fcac36e050de337b670d8bd; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY (id);


--
-- Name: users UQ_17d1817f241f10a3dbafb169fd2; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_17d1817f241f10a3dbafb169fd2" UNIQUE (phone_number);


--
-- Name: users UQ_6f828bb866308ab509c0e6fd873; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_6f828bb866308ab509c0e6fd873" UNIQUE (kakao_id);


--
-- Name: payments UQ_7eabbfacab96b5db651b567f36e; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "UQ_7eabbfacab96b5db651b567f36e" UNIQUE (pg_tid);


--
-- Name: capsule_access_logs UQ_8eb9c3ca0fb9586452ef3ebc774; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsule_access_logs
    ADD CONSTRAINT "UQ_8eb9c3ca0fb9586452ef3ebc774" UNIQUE (capsule_id, viewer_id);


--
-- Name: friendships UQ_a8e4ede8e2df44f3f21f557d379; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT "UQ_a8e4ede8e2df44f3f21f557d379" UNIQUE (user_id, friend_id);


--
-- Name: payments UQ_b2f7b823a21562eeca20e72b006; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "UQ_b2f7b823a21562eeca20e72b006" UNIQUE (order_id);


--
-- Name: media UQ_f5e482d57c690b64a71bd887439; Type: CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT "UQ_f5e482d57c690b64a71bd887439" UNIQUE (object_key);


--
-- Name: capsule_access_logs FK_1fc0e3f712b5e335bffec2fd8fa; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsule_access_logs
    ADD CONSTRAINT "FK_1fc0e3f712b5e335bffec2fd8fa" FOREIGN KEY (capsule_id) REFERENCES public.capsules(id) ON DELETE CASCADE;


--
-- Name: friendships FK_972c6bdd4bc18dda48b8aa4714c; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT "FK_972c6bdd4bc18dda48b8aa4714c" FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: capsules FK_999e0336a47ab545da76d231ee5; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsules
    ADD CONSTRAINT "FK_999e0336a47ab545da76d231ee5" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders FK_a922b820eeef29ac1c6800e826a; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: customer_services FK_abbeaa123ca82c2317f63b9857e; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "FK_abbeaa123ca82c2317f63b9857e" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders FK_ac832121b6c331b084ecc4121fd; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_ac832121b6c331b084ecc4121fd" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: capsule_access_logs FK_b0636ad5a72b9b665d8dfc6b3be; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsule_access_logs
    ADD CONSTRAINT "FK_b0636ad5a72b9b665d8dfc6b3be" FOREIGN KEY (viewer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments FK_b2f7b823a21562eeca20e72b006; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: media FK_c0dd13ee4ffc96e61bdc1fb592d; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT "FK_c0dd13ee4ffc96e61bdc1fb592d" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships FK_c73eec6c7e7d5d1f2b3ce8b9002; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT "FK_c73eec6c7e7d5d1f2b3ce8b9002" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: capsules FK_f640d2d2e916b12c762afdac12c; Type: FK CONSTRAINT; Schema: public; Owner: kimdongeun
--

ALTER TABLE ONLY public.capsules
    ADD CONSTRAINT "FK_f640d2d2e916b12c762afdac12c" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--

