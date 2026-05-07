-- ─────────────────────────────────────────────────────────────────
-- Wire apim_publisher SP to existing SadaSSO IdP (federated-only).
-- Idempotent: cleans up prior rows first.
-- ─────────────────────────────────────────────────────────────────

USE apim_db;

SET @APP_ID  = (SELECT ID FROM SP_APP WHERE APP_NAME='apim_publisher' AND TENANT_ID=-1234);
SET @AUTH_ID = (SELECT a.ID FROM IDP_AUTHENTICATOR a
                  JOIN IDP i ON a.IDP_ID=i.ID
                  WHERE i.NAME='SadaSSO' AND a.NAME='OpenIDConnectAuthenticator' AND a.TENANT_ID=-1234);

-- Cleanup
DELETE fed FROM SP_FEDERATED_IDP fed
  JOIN SP_AUTH_STEP step ON fed.ID = step.ID
  WHERE step.APP_ID = @APP_ID;
DELETE FROM SP_AUTH_STEP WHERE APP_ID = @APP_ID;

-- Wire
UPDATE SP_APP SET AUTH_TYPE='federated' WHERE ID=@APP_ID;

INSERT INTO SP_AUTH_STEP (TENANT_ID, STEP_ORDER, APP_ID, IS_SUBJECT_STEP, IS_ATTRIBUTE_STEP)
VALUES (-1234, 1, @APP_ID, '1', '1');

SET @STEP_ID = LAST_INSERT_ID();

INSERT INTO SP_FEDERATED_IDP (ID, TENANT_ID, AUTHENTICATOR_ID)
VALUES (@STEP_ID, -1234, @AUTH_ID);

-- Verify
SELECT app.APP_NAME, app.AUTH_TYPE, step.ID AS step_id, fed.AUTHENTICATOR_ID, idp.NAME AS idp
  FROM SP_APP app
  JOIN SP_AUTH_STEP step ON step.APP_ID=app.ID
  JOIN SP_FEDERATED_IDP fed ON fed.ID=step.ID
  JOIN IDP_AUTHENTICATOR a ON a.ID=fed.AUTHENTICATOR_ID
  JOIN IDP idp ON idp.ID=a.IDP_ID
  WHERE app.APP_NAME='apim_publisher';
