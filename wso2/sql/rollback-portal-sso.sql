-- ─────────────────────────────────────────────────────────────────
-- ROLLBACK: restore apim_devportal + apim_publisher SPs to local-only
-- (AUTH_TYPE='default'). Removes step + federated-idp links + the
-- BasicAuthenticator row we added under LOCAL IdP.
--
-- SadaSSO IdP itself is left intact (can be re-wired later).
-- ─────────────────────────────────────────────────────────────────

USE apim_db;

-- Remove SP step wiring for both portals
DELETE fed FROM SP_FEDERATED_IDP fed
  JOIN SP_AUTH_STEP step ON fed.ID = step.ID
  JOIN SP_APP app         ON step.APP_ID = app.ID
  WHERE app.APP_NAME IN ('apim_devportal','apim_publisher') AND app.TENANT_ID=-1234;

DELETE step FROM SP_AUTH_STEP step
  JOIN SP_APP app ON step.APP_ID = app.ID
  WHERE app.APP_NAME IN ('apim_devportal','apim_publisher') AND app.TENANT_ID=-1234;

UPDATE SP_APP SET AUTH_TYPE='default'
  WHERE APP_NAME IN ('apim_devportal','apim_publisher') AND TENANT_ID=-1234;

-- Remove the BasicAuthenticator row we inserted into LOCAL IdP
DELETE FROM IDP_AUTHENTICATOR
  WHERE TENANT_ID=-1234
    AND NAME='BasicAuthenticator'
    AND IDP_ID = (SELECT ID FROM IDP WHERE NAME='LOCAL' AND TENANT_ID=-1234);

-- Verify
SELECT APP_NAME, AUTH_TYPE FROM SP_APP WHERE APP_NAME LIKE 'apim_%' AND TENANT_ID=-1234;
SELECT 'auth steps remaining' AS check_, COUNT(*) AS n FROM SP_AUTH_STEP step
  JOIN SP_APP app ON step.APP_ID=app.ID
  WHERE app.APP_NAME IN ('apim_devportal','apim_publisher');
SELECT 'BasicAuthenticator rows in LOCAL' AS check_, COUNT(*) AS n FROM IDP_AUTHENTICATOR
  WHERE NAME='BasicAuthenticator' AND IDP_ID=(SELECT ID FROM IDP WHERE NAME='LOCAL');
