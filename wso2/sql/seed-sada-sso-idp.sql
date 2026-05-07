-- ─────────────────────────────────────────────────────────────────
-- Seed SadaSSO Federated IdP into APIM's apim_db (super tenant)
-- and wire apim_devportal SP to use it (federated-only mode).
--
-- Idempotent: re-running cleans up prior rows first.
-- Tenant: -1234 (carbon.super)
-- ─────────────────────────────────────────────────────────────────

USE apim_db;

-- ── Cleanup (idempotency) ────────────────────────────────────────
-- Delete child rows first (FK order)
DELETE FROM SP_FEDERATED_IDP
  WHERE AUTHENTICATOR_ID IN (
    SELECT ID FROM IDP_AUTHENTICATOR WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234)
  );

DELETE step FROM SP_AUTH_STEP step
  JOIN SP_APP app ON step.APP_ID = app.ID
  WHERE app.APP_NAME='apim_devportal' AND app.TENANT_ID=-1234;

DELETE FROM IDP_CLAIM_MAPPING WHERE IDP_CLAIM_ID IN (
  SELECT ID FROM IDP_CLAIM WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234)
);
DELETE FROM IDP_CLAIM WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234);
DELETE FROM IDP_AUTHENTICATOR_PROPERTY WHERE AUTHENTICATOR_ID IN (
  SELECT ID FROM IDP_AUTHENTICATOR WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234)
);
DELETE FROM IDP_AUTHENTICATOR WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234);
DELETE FROM IDP_PROVISIONING_CONFIG WHERE IDP_ID = (SELECT ID FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234);
DELETE FROM IDP WHERE NAME='SadaSSO' AND TENANT_ID=-1234;

-- ── 1) Create IDP row ────────────────────────────────────────────
INSERT INTO IDP (
  TENANT_ID, NAME, IS_ENABLED, IS_PRIMARY,
  HOME_REALM_ID, ALIAS,
  USER_CLAIM_URI, ROLE_CLAIM_URI,
  DESCRIPTION, DEFAULT_AUTHENTICATOR_NAME,
  IS_FEDERATION_HUB, IS_LOCAL_CLAIM_DIALECT,
  DISPLAY_NAME, UUID
) VALUES (
  -1234, 'SadaSSO', '1', '0',
  'sada-sso', 'https://localhost:9443/oauth2/token',
  'http://wso2.org/claims/username', 'http://wso2.org/claims/role',
  'Sada API OIDC Federated Identity Provider',
  'OpenIDConnectAuthenticator',
  '0', '0',
  'Sada SSO', UUID()
);

SET @IDP_ID = LAST_INSERT_ID();

-- ── 2) Create OpenIDConnect authenticator ───────────────────────
INSERT INTO IDP_AUTHENTICATOR (TENANT_ID, IDP_ID, NAME, IS_ENABLED, DISPLAY_NAME)
VALUES (-1234, @IDP_ID, 'OpenIDConnectAuthenticator', '1', 'openidconnect');

SET @AUTH_ID = LAST_INSERT_ID();

-- ── 3) OIDC properties ──────────────────────────────────────────
INSERT INTO IDP_AUTHENTICATOR_PROPERTY (TENANT_ID, AUTHENTICATOR_ID, PROPERTY_KEY, PROPERTY_VALUE, IS_SECRET) VALUES
  (-1234, @AUTH_ID, 'ClientId',                  '2212a3222dc401d84a5b589963936f51', '0'),
  (-1234, @AUTH_ID, 'ClientSecret',              '23fe62bdeb6b7216590aa8d3d7f60d747135f904ba8aceec0cb6e1d1d43c6003', '1'),
  (-1234, @AUTH_ID, 'OAuth2AuthzEPUrl',          'http://localhost:3002/authorize', '0'),
  (-1234, @AUTH_ID, 'OAuth2TokenEPUrl',          'http://host.docker.internal:3001/oauth/token', '0'),
  (-1234, @AUTH_ID, 'UserInfoUrl',               'http://host.docker.internal:3001/oauth/userinfo', '0'),
  (-1234, @AUTH_ID, 'OIDCLogoutEPUrl',           'http://localhost:3001/oauth/logout', '0'),
  (-1234, @AUTH_ID, 'callbackUrl',               'https://localhost:9443/commonauth', '0'),
  (-1234, @AUTH_ID, 'Scopes',                    'openid email profile', '0'),
  (-1234, @AUTH_ID, 'commonAuthQueryParams',     'scope=openid+email+profile', '0'),
  (-1234, @AUTH_ID, 'IsBasicAuthEnabled',        'true', '0'),
  (-1234, @AUTH_ID, 'IsUserIdInClaims',          'false', '0'),
  (-1234, @AUTH_ID, 'commonAuthClientType',      'oidc', '0');

-- ── 4) Claim mappings (sada-api claim → WSO2 local claim) ───────
INSERT INTO IDP_CLAIM (IDP_ID, TENANT_ID, CLAIM) VALUES
  (@IDP_ID, -1234, 'sub'),
  (@IDP_ID, -1234, 'email'),
  (@IDP_ID, -1234, 'name'),
  (@IDP_ID, -1234, 'preferred_username');

INSERT INTO IDP_CLAIM_MAPPING (IDP_CLAIM_ID, TENANT_ID, LOCAL_CLAIM, IS_REQUESTED)
SELECT ID, -1234,
  CASE CLAIM
    WHEN 'sub'                 THEN 'http://wso2.org/claims/username'
    WHEN 'email'               THEN 'http://wso2.org/claims/emailaddress'
    WHEN 'name'                THEN 'http://wso2.org/claims/displayName'
    WHEN 'preferred_username'  THEN 'http://wso2.org/claims/nickname'
  END,
  '1'
FROM IDP_CLAIM WHERE IDP_ID = @IDP_ID;

-- ── 5) JIT user provisioning enabled (auto-create local user on first SSO) ──
INSERT INTO IDP_PROVISIONING_CONFIG (TENANT_ID, IDP_ID, PROVISIONING_CONNECTOR_TYPE, IS_ENABLED, IS_BLOCKING)
VALUES (-1234, @IDP_ID, 'JIT_PROVISIONING', '1', '0');

-- ── 6) Wire apim_devportal SP to federated-only mode ────────────
SET @APP_ID = (SELECT ID FROM SP_APP WHERE APP_NAME='apim_devportal' AND TENANT_ID=-1234);

UPDATE SP_APP SET AUTH_TYPE='federated' WHERE ID=@APP_ID;

INSERT INTO SP_AUTH_STEP (TENANT_ID, STEP_ORDER, APP_ID, IS_SUBJECT_STEP, IS_ATTRIBUTE_STEP)
VALUES (-1234, 1, @APP_ID, '1', '1');

SET @STEP_ID = LAST_INSERT_ID();

INSERT INTO SP_FEDERATED_IDP (ID, TENANT_ID, AUTHENTICATOR_ID)
VALUES (@STEP_ID, -1234, @AUTH_ID);

-- ── Verify ──────────────────────────────────────────────────────
SELECT 'IDP created' AS step, NAME, ID FROM IDP WHERE NAME='SadaSSO';
SELECT 'authenticator' AS step, NAME, ID FROM IDP_AUTHENTICATOR WHERE IDP_ID=@IDP_ID;
SELECT 'props' AS step, COUNT(*) AS n FROM IDP_AUTHENTICATOR_PROPERTY WHERE AUTHENTICATOR_ID=@AUTH_ID;
SELECT 'claims' AS step, COUNT(*) AS n FROM IDP_CLAIM_MAPPING WHERE IDP_CLAIM_ID IN (SELECT ID FROM IDP_CLAIM WHERE IDP_ID=@IDP_ID);
SELECT 'sp wired' AS step, app.APP_NAME, app.AUTH_TYPE, step.ID AS step_id, fed.AUTHENTICATOR_ID
  FROM SP_APP app
  JOIN SP_AUTH_STEP step ON step.APP_ID=app.ID
  JOIN SP_FEDERATED_IDP fed ON fed.ID=step.ID
  WHERE app.APP_NAME='apim_devportal';
