-- ─────────────────────────────────────────────────────────────────
-- Switch devportal + publisher SPs from federated-only to "flow" mode
-- so the WSO2 authentication endpoint (login.do) is shown with BOTH
-- local username/password AND a "Sign in with SadaSSO" button.
--
-- Adds a BasicAuthenticator local-authenticator row to the same step
-- as the SadaSSO federated authenticator.
-- ─────────────────────────────────────────────────────────────────

USE apim_db;

-- 1) Ensure LOCAL IdP has a BasicAuthenticator row (idempotent)
SET @LOCAL_IDP_ID = (SELECT ID FROM IDP WHERE NAME='LOCAL' AND TENANT_ID=-1234);

INSERT INTO IDP_AUTHENTICATOR (TENANT_ID, IDP_ID, NAME, IS_ENABLED, DISPLAY_NAME)
SELECT -1234, @LOCAL_IDP_ID, 'BasicAuthenticator', '1', 'basic'
WHERE NOT EXISTS (
  SELECT 1 FROM IDP_AUTHENTICATOR
   WHERE IDP_ID=@LOCAL_IDP_ID AND NAME='BasicAuthenticator' AND TENANT_ID=-1234
);

SET @BASIC_AUTH_ID = (SELECT ID FROM IDP_AUTHENTICATOR
                      WHERE IDP_ID=@LOCAL_IDP_ID AND NAME='BasicAuthenticator' AND TENANT_ID=-1234);

-- 2) Switch AUTH_TYPE flow + add BasicAuthenticator to existing step
SET @SADA_AUTH_ID = (SELECT a.ID FROM IDP_AUTHENTICATOR a
                       JOIN IDP i ON a.IDP_ID=i.ID
                       WHERE i.NAME='SadaSSO' AND a.NAME='OpenIDConnectAuthenticator');

-- For each portal: change AUTH_TYPE, add local auth to step (skip dup)
-- Devportal
SET @APP_DP = (SELECT ID FROM SP_APP WHERE APP_NAME='apim_devportal' AND TENANT_ID=-1234);
SET @STEP_DP = (SELECT step.ID FROM SP_AUTH_STEP step WHERE step.APP_ID=@APP_DP);

UPDATE SP_APP SET AUTH_TYPE='flow' WHERE ID=@APP_DP;

INSERT INTO SP_FEDERATED_IDP (ID, TENANT_ID, AUTHENTICATOR_ID)
SELECT @STEP_DP, -1234, @BASIC_AUTH_ID
WHERE NOT EXISTS (
  SELECT 1 FROM SP_FEDERATED_IDP WHERE ID=@STEP_DP AND AUTHENTICATOR_ID=@BASIC_AUTH_ID
);

-- Publisher
SET @APP_PUB = (SELECT ID FROM SP_APP WHERE APP_NAME='apim_publisher' AND TENANT_ID=-1234);
SET @STEP_PUB = (SELECT step.ID FROM SP_AUTH_STEP step WHERE step.APP_ID=@APP_PUB);

UPDATE SP_APP SET AUTH_TYPE='flow' WHERE ID=@APP_PUB;

INSERT INTO SP_FEDERATED_IDP (ID, TENANT_ID, AUTHENTICATOR_ID)
SELECT @STEP_PUB, -1234, @BASIC_AUTH_ID
WHERE NOT EXISTS (
  SELECT 1 FROM SP_FEDERATED_IDP WHERE ID=@STEP_PUB AND AUTHENTICATOR_ID=@BASIC_AUTH_ID
);

-- Verify
SELECT app.APP_NAME, app.AUTH_TYPE, step.ID AS step_id,
       fed.AUTHENTICATOR_ID, a.NAME AS authenticator, idp.NAME AS idp
  FROM SP_APP app
  JOIN SP_AUTH_STEP step ON step.APP_ID=app.ID
  JOIN SP_FEDERATED_IDP fed ON fed.ID=step.ID
  JOIN IDP_AUTHENTICATOR a ON a.ID=fed.AUTHENTICATOR_ID
  JOIN IDP idp ON idp.ID=a.IDP_ID
  WHERE app.APP_NAME IN ('apim_devportal','apim_publisher')
  ORDER BY app.APP_NAME, idp.NAME;
