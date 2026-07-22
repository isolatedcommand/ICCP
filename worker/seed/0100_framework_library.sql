-- ICCP framework library — starter pack.
-- Representative, structurally complete requirement sets for six frameworks,
-- linked by shared concepts for cross-framework mapping. Extend by appending
-- rows — the schema and UI need no change to carry the full catalogues.

-- ── Frameworks ─────────────────────────────────────────────────────────────
INSERT INTO frameworks (id, name, short_name, version, publisher, description, structure) VALUES
('iso27001-2022','ISO/IEC 27001:2022','ISO 27001','2022','ISO/IEC','Information security management system requirements with Annex A controls.','flat'),
('soc2-2017','SOC 2 Trust Services Criteria','SOC 2','2017 (2022 points of focus)','AICPA','Trust Services Criteria: Security, Availability, Processing Integrity, Confidentiality, Privacy.','principle'),
('nist-csf-2.0','NIST Cybersecurity Framework','NIST CSF','2.0','NIST','Functions: Govern, Identify, Protect, Detect, Respond, Recover.','function'),
('cis-v8','CIS Critical Security Controls','CIS v8','8.1','Center for Internet Security','Prioritised safeguards in Implementation Groups IG1–IG3.','flat'),
('sg-ctm','Cybersecurity Trust Mark (Cyber Trust)','Cyber Trust Mark','2024','CSA Singapore','CSA Cyber Trust mark — tiered cybersecurity preparedness for organisations.','tier'),
('sg-pdpa','Personal Data Protection Act','PDPA','2020 (amended)','PDPC Singapore','Singapore data protection obligations for organisations.','flat');

-- ── ISO/IEC 27001:2022 ─────────────────────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('iso27001-2022/4.3','iso27001-2022','4.3','Determining the scope of the ISMS','Clause 4 — Context','Define ISMS boundaries and applicability.','Document scope considering internal/external issues, interfaces and dependencies.','["ISMS Scope Statement"]'),
('iso27001-2022/5.2','iso27001-2022','5.2','Information security policy','Clause 5 — Leadership','Top management establishes an information security policy.','Policy appropriate to purpose, communicated, available to interested parties.','["Information Security Policy","Management approval record"]'),
('iso27001-2022/6.1.2','iso27001-2022','6.1.2','Information security risk assessment','Clause 6 — Planning','Define and apply a risk assessment process.','Criteria for risk acceptance; consistent, valid, comparable results.','["Risk Assessment Methodology","Risk Register"]'),
('iso27001-2022/8.1','iso27001-2022','8.1','Operational planning and control','Clause 8 — Operation','Plan, implement and control processes to meet requirements.','Keep documented information; control planned changes.','["Operating procedures","Change records"]'),
('iso27001-2022/9.2','iso27001-2022','9.2','Internal audit','Clause 9 — Performance evaluation','Conduct internal ISMS audits at planned intervals.','Audit programme, criteria/scope per audit, impartial auditors, reported results.','["Internal Audit Programme","Audit Reports"]'),
('iso27001-2022/10.1','iso27001-2022','10.1','Continual improvement','Clause 10 — Improvement','Continually improve the ISMS.','Nonconformity handling, corrective action, effectiveness review.','["Corrective Action Log"]'),
('iso27001-2022/A.5.1','iso27001-2022','A.5.1','Policies for information security','Annex A — Organisational','Management direction for information security.','Define, approve, publish, communicate and review policies.','["Information Security Policy","Policy review records"]'),
('iso27001-2022/A.5.9','iso27001-2022','A.5.9','Inventory of information and other associated assets','Annex A — Organisational','Identify and maintain an asset inventory.','Inventory of information and associated assets with owners.','["Asset Inventory","Asset ownership records"]'),
('iso27001-2022/A.5.15','iso27001-2022','A.5.15','Access control','Annex A — Organisational','Ensure authorised access and prevent unauthorised access.','Rules based on business and security requirements; least privilege.','["Access Control Policy","User Access Review","Privileged Account Inventory","IAM Configuration"]'),
('iso27001-2022/A.5.17','iso27001-2022','A.5.17','Authentication information','Annex A — Organisational','Proper management of secret authentication information.','Password policy, secure issuance, MFA where warranted.','["Password Policy","MFA Configuration Export"]'),
('iso27001-2022/A.5.23','iso27001-2022','A.5.23','Information security for use of cloud services','Annex A — Organisational','Manage security of cloud service acquisition and use.','Cloud usage policy, provider due diligence, exit strategy.','["Cloud Usage Policy","Provider assessments"]'),
('iso27001-2022/A.5.24','iso27001-2022','A.5.24','Incident management planning and preparation','Annex A — Organisational','Prepare to manage information security incidents.','Roles, procedures, reporting channels, response plans.','["Incident Response Plan","IR test records"]'),
('iso27001-2022/A.6.3','iso27001-2022','A.6.3','Information security awareness, education and training','Annex A — People','Personnel receive appropriate awareness and training.','Programme, onboarding, periodic refresh, records.','["Security Awareness Training Records"]'),
('iso27001-2022/A.8.2','iso27001-2022','A.8.2','Privileged access rights','Annex A — Technological','Restrict and manage privileged access.','Allocate per-use, review regularly, log use.','["Privileged Account Inventory","Privileged Access Review"]'),
('iso27001-2022/A.8.7','iso27001-2022','A.8.7','Protection against malware','Annex A — Technological','Protect against malware.','Detection, prevention, awareness combined.','["Endpoint Protection Report"]'),
('iso27001-2022/A.8.8','iso27001-2022','A.8.8','Management of technical vulnerabilities','Annex A — Technological','Prevent exploitation of technical vulnerabilities.','Asset visibility, scanning, patch SLAs.','["Vulnerability Scan Reports","Patch Management Records"]'),
('iso27001-2022/A.8.13','iso27001-2022','A.8.13','Information backup','Annex A — Technological','Maintain and test backups.','Backup policy, schedules, restoration tests.','["Backup Policy","Restore Test Records"]'),
('iso27001-2022/A.8.16','iso27001-2022','A.8.16','Monitoring activities','Annex A — Technological','Detect anomalous behaviour and potential incidents.','Monitor networks/systems/applications; act on anomalies.','["SIEM/Log Monitoring Config","Alert runbooks"]');

-- ── SOC 2 TSC ──────────────────────────────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('soc2-2017/CC1.2','soc2-2017','CC1.2','Board oversight','Security (Common Criteria)','The board exercises oversight of internal control.','Governance charter, independent oversight of management.','["Governance charter","Board minutes"]'),
('soc2-2017/CC2.1','soc2-2017','CC2.1','Information to support internal control','Security (Common Criteria)','Obtain/generate relevant quality information.','Security metrics, monitoring outputs feeding decisions.','["Security metrics reports"]'),
('soc2-2017/CC5.2','soc2-2017','CC5.2','Technology general controls','Security (Common Criteria)','Select and develop general control activities over technology.','Change management, access provisioning, operations controls.','["Change Management Policy","Change tickets sample"]'),
('soc2-2017/CC6.1','soc2-2017','CC6.1','Logical access security','Security (Common Criteria)','Restrict logical access to authorised users.','Boundary protection, identification/authentication, least privilege.','["Access Control Policy","IAM Configuration"]'),
('soc2-2017/CC6.2','soc2-2017','CC6.2','User registration and authorisation','Security (Common Criteria)','Register, authorise and de-register users.','Joiner-mover-leaver, periodic access review.','["User Access Review","Offboarding checklist"]'),
('soc2-2017/CC6.3','soc2-2017','CC6.3','Role-based access and least privilege','Security (Common Criteria)','Manage access via roles and least privilege.','RBAC, privileged access management, segregation of duties.','["Privileged Access Review","RBAC matrix"]'),
('soc2-2017/CC7.1','soc2-2017','CC7.1','Vulnerability detection and monitoring','Security (Common Criteria)','Detect configuration changes and new vulnerabilities.','Vulnerability scanning, configuration monitoring.','["Vulnerability Scan Reports"]'),
('soc2-2017/CC7.3','soc2-2017','CC7.3','Security incident evaluation','Security (Common Criteria)','Evaluate security events; determine incidents.','Incident response procedures, post-mortems.','["Incident Response Plan","Incident records"]'),
('soc2-2017/A1.2','soc2-2017','A1.2','Recovery infrastructure','Availability','Environmental protections, backup and recovery infrastructure.','Backups, replication, recovery testing.','["Backup Policy","Restore Test Records"]'),
('soc2-2017/C1.1','soc2-2017','C1.1','Confidential information identification','Confidentiality','Identify and maintain confidential information.','Data classification, handling requirements.','["Data Classification Policy"]'),
('soc2-2017/P4.2','soc2-2017','P4.2','Personal information retention','Privacy','Retain personal information consistent with objectives.','Retention schedule, secure disposal.','["Data Retention Schedule","Disposal records"]');

-- ── NIST CSF 2.0 ───────────────────────────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('nist-csf-2.0/GV.OC-01','nist-csf-2.0','GV.OC-01','Organisational cybersecurity context','Govern','Mission and context understood for cyber risk decisions.','Document context, stakeholders, dependencies.','["Context/scope statement"]'),
('nist-csf-2.0/ID.AM-01','nist-csf-2.0','ID.AM-01','Hardware asset inventory','Identify','Inventories of hardware maintained.','Automated discovery preferred; assign owners.','["Asset Inventory"]'),
('nist-csf-2.0/ID.RA-01','nist-csf-2.0','ID.RA-01','Vulnerability identification','Identify','Vulnerabilities in assets identified and recorded.','Scanning cadence, disclosure intake.','["Vulnerability Scan Reports"]'),
('nist-csf-2.0/PR.AA-01','nist-csf-2.0','PR.AA-01','Identity and credential management','Protect','Identities and credentials managed for authorised users/devices.','Lifecycle: issuance, proofing, revocation, MFA.','["IAM Configuration","MFA Configuration Export"]'),
('nist-csf-2.0/PR.AA-05','nist-csf-2.0','PR.AA-05','Access permissions and least privilege','Protect','Access permissions incorporate least privilege and separation of duties.','RBAC, periodic review, privileged controls.','["User Access Review","Privileged Account Inventory"]'),
('nist-csf-2.0/PR.AT-01','nist-csf-2.0','PR.AT-01','Awareness and training','Protect','Personnel provided awareness and training.','Role-based content, refresh cadence, records.','["Security Awareness Training Records"]'),
('nist-csf-2.0/PR.DS-11','nist-csf-2.0','PR.DS-11','Data backups','Protect','Backups of data created, protected, maintained, tested.','Coverage, isolation, restore testing.','["Backup Policy","Restore Test Records"]'),
('nist-csf-2.0/DE.CM-01','nist-csf-2.0','DE.CM-01','Network monitoring','Detect','Networks monitored to find adverse events.','Log aggregation, detection content, alerting.','["SIEM/Log Monitoring Config"]'),
('nist-csf-2.0/RS.MA-01','nist-csf-2.0','RS.MA-01','Incident response execution','Respond','Incident response plan executed with third parties as needed.','Declared criteria, roles, communications.','["Incident Response Plan","Incident records"]'),
('nist-csf-2.0/RC.RP-01','nist-csf-2.0','RC.RP-01','Recovery plan execution','Recover','Recovery portion of IR plan executed.','Restore priorities, integrity verification.','["Recovery runbooks","Restore Test Records"]');

-- ── CIS Controls v8 ────────────────────────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('cis-v8/1.1','cis-v8','1.1','Establish and maintain a detailed enterprise asset inventory','IG1 — Control 1','Actively manage all enterprise assets.','Update inventory at least bi-annually; include network address, owner.','["Asset Inventory"]'),
('cis-v8/4.1','cis-v8','4.1','Establish and maintain a secure configuration process','IG1 — Control 4','Secure configurations for assets and software.','Baseline configs, drift review cadence.','["Configuration baselines"]'),
('cis-v8/5.1','cis-v8','5.1','Establish and maintain an inventory of accounts','IG1 — Control 5','Inventory of all user and admin accounts.','Quarterly validation of active accounts.','["User Account Inventory","User Access Review"]'),
('cis-v8/5.4','cis-v8','5.4','Restrict administrator privileges to dedicated admin accounts','IG1 — Control 5','Least privilege for administrative access.','Separate admin accounts, no daily-driver admin use.','["Privileged Account Inventory"]'),
('cis-v8/6.3','cis-v8','6.3','Require MFA for externally-exposed applications','IG1 — Control 6','MFA on all external applications.','Enforce via IdP; document exceptions.','["MFA Configuration Export"]'),
('cis-v8/7.1','cis-v8','7.1','Establish and maintain a vulnerability management process','IG1 — Control 7','Continuous vulnerability management.','Scan cadence, remediation SLAs.','["Vulnerability Management Policy","Vulnerability Scan Reports"]'),
('cis-v8/10.1','cis-v8','10.1','Deploy and maintain anti-malware software','IG1 — Control 10','Malware defences on enterprise assets.','Centrally managed, signatures + behavioural.','["Endpoint Protection Report"]'),
('cis-v8/11.1','cis-v8','11.1','Establish and maintain a data recovery process','IG1 — Control 11','Data recovery practices sufficient to restore in-scope assets.','Backup scope, frequency, protection, testing.','["Backup Policy","Restore Test Records"]'),
('cis-v8/14.1','cis-v8','14.1','Establish and maintain a security awareness program','IG1 — Control 14','Workforce security awareness.','Annual training minimum, onboarding coverage.','["Security Awareness Training Records"]'),
('cis-v8/17.1','cis-v8','17.1','Designate personnel for incident handling','IG1 — Control 17','Incident handling capability established.','Primary/backup handlers, escalation paths.','["Incident Response Plan"]');

-- ── CSA Cyber Trust Mark (Singapore) ───────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('sg-ctm/B1','sg-ctm','B1','Governance — cybersecurity policy and leadership','Tier: Supporter+','Leadership commitment and policy set the direction.','Assessment: approved policy, assigned responsibility.','["Information Security Policy","Role assignments"]'),
('sg-ctm/B4','sg-ctm','B4','Asset inventory and management','Tier: Practitioner+','Know and manage hardware/software assets.','Assessment: current inventory, ownership, lifecycle.','["Asset Inventory"]'),
('sg-ctm/B6','sg-ctm','B6','Access control and privileged account management','Tier: Practitioner+','Control access to systems and data; manage admin accounts.','Assessment: access policy, reviews, privileged inventory, MFA.','["Access Control Policy","User Access Review","Privileged Account Inventory","MFA Configuration Export"]'),
('sg-ctm/B8','sg-ctm','B8','Vulnerability and patch management','Tier: Practitioner+','Identify and remediate vulnerabilities timely.','Assessment: scanning records, patch SLAs, exception handling.','["Vulnerability Scan Reports","Patch Management Records"]'),
('sg-ctm/B10','sg-ctm','B10','Backup and recovery','Tier: Practitioner+','Protect data availability through tested backups.','Assessment: backup schedule, offline/immutable copy, restore tests.','["Backup Policy","Restore Test Records"]'),
('sg-ctm/B12','sg-ctm','B12','Incident response readiness','Tier: Promoter+','Prepare to detect, respond and recover from incidents.','Assessment: IR plan, contact tree, exercise records.','["Incident Response Plan","IR test records"]'),
('sg-ctm/B14','sg-ctm','B14','Security awareness and training','Tier: Supporter+','Build workforce cyber hygiene.','Assessment: training completion records, phishing drills.','["Security Awareness Training Records"]');

-- ── PDPA (Singapore) ───────────────────────────────────────────────────────
INSERT INTO requirements (id, framework_id, code, title, grouping, objective, guidance, evidence_hints) VALUES
('sg-pdpa/OB-CONSENT','sg-pdpa','OB-CONSENT','Consent obligation','Obligation','Collect/use/disclose personal data only with consent or lawful basis.','Consent capture, purpose limitation, withdrawal handling.','["Consent records","Privacy notice"]'),
('sg-pdpa/OB-PURPOSE','sg-pdpa','OB-PURPOSE','Purpose limitation obligation','Obligation','Use personal data only for purposes a reasonable person considers appropriate.','Purpose register mapped to processing activities.','["Data inventory / ROPA"]'),
('sg-pdpa/OB-PROTECT','sg-pdpa','OB-PROTECT','Protection obligation','Obligation','Reasonable security arrangements to protect personal data.','Technical + organisational measures proportional to sensitivity.','["Access Control Policy","Encryption standards","Data Protection Policy"]'),
('sg-pdpa/OB-RETENTION','sg-pdpa','OB-RETENTION','Retention limitation obligation','Obligation','Cease retention when purpose no longer served.','Retention schedule, disposal procedures, anonymisation.','["Data Retention Schedule","Disposal records"]'),
('sg-pdpa/OB-BREACH','sg-pdpa','OB-BREACH','Data breach notification obligation','Obligation','Assess breaches; notify PDPC/affected individuals when notifiable.','Breach response procedure, 3-day assessment discipline.','["Data Breach Response Procedure","Breach register"]'),
('sg-pdpa/OB-DPO','sg-pdpa','OB-DPO','Accountability — DPO designation','Obligation','Designate a Data Protection Officer; make contact public.','DPO appointment, published contact, governance reporting.','["DPO appointment record"]'),
('sg-pdpa/OB-ACCESS','sg-pdpa','OB-ACCESS','Access and correction obligation','Obligation','Respond to access/correction requests for personal data.','DSAR procedure, response tracking within timelines.','["DSAR procedure","Request log"]');

-- ── Cross-framework concepts (the mapping fabric) ──────────────────────────
INSERT INTO requirement_concepts (requirement_id, concept) VALUES
-- access control cluster: ISO A.5.15 ↔ SOC CC6.1/CC6.2/CC6.3 ↔ NIST PR.AA ↔ CIS 5/6 ↔ CTM B6 ↔ PDPA protect
('iso27001-2022/A.5.15','access-control'),('soc2-2017/CC6.1','access-control'),('soc2-2017/CC6.2','access-control'),
('nist-csf-2.0/PR.AA-05','access-control'),('cis-v8/5.1','access-control'),('sg-ctm/B6','access-control'),('sg-pdpa/OB-PROTECT','access-control'),
('iso27001-2022/A.8.2','privileged-access'),('soc2-2017/CC6.3','privileged-access'),('cis-v8/5.4','privileged-access'),('sg-ctm/B6','privileged-access'),('nist-csf-2.0/PR.AA-05','privileged-access'),
('iso27001-2022/A.5.17','mfa'),('cis-v8/6.3','mfa'),('nist-csf-2.0/PR.AA-01','mfa'),('sg-ctm/B6','mfa'),
-- asset inventory cluster
('iso27001-2022/A.5.9','asset-inventory'),('nist-csf-2.0/ID.AM-01','asset-inventory'),('cis-v8/1.1','asset-inventory'),('sg-ctm/B4','asset-inventory'),
-- vulnerability management cluster
('iso27001-2022/A.8.8','vulnerability-management'),('soc2-2017/CC7.1','vulnerability-management'),('nist-csf-2.0/ID.RA-01','vulnerability-management'),('cis-v8/7.1','vulnerability-management'),('sg-ctm/B8','vulnerability-management'),
-- backup / recovery cluster
('iso27001-2022/A.8.13','backup-recovery'),('soc2-2017/A1.2','backup-recovery'),('nist-csf-2.0/PR.DS-11','backup-recovery'),('cis-v8/11.1','backup-recovery'),('sg-ctm/B10','backup-recovery'),('nist-csf-2.0/RC.RP-01','backup-recovery'),
-- incident response cluster
('iso27001-2022/A.5.24','incident-response'),('soc2-2017/CC7.3','incident-response'),('nist-csf-2.0/RS.MA-01','incident-response'),('cis-v8/17.1','incident-response'),('sg-ctm/B12','incident-response'),('sg-pdpa/OB-BREACH','incident-response'),
-- awareness cluster
('iso27001-2022/A.6.3','security-awareness'),('nist-csf-2.0/PR.AT-01','security-awareness'),('cis-v8/14.1','security-awareness'),('sg-ctm/B14','security-awareness'),
-- governance / policy cluster
('iso27001-2022/5.2','security-policy'),('iso27001-2022/A.5.1','security-policy'),('soc2-2017/CC1.2','security-policy'),('nist-csf-2.0/GV.OC-01','security-policy'),('sg-ctm/B1','security-policy'),
-- monitoring cluster
('iso27001-2022/A.8.16','monitoring'),('nist-csf-2.0/DE.CM-01','monitoring'),('soc2-2017/CC2.1','monitoring'),
-- malware cluster
('iso27001-2022/A.8.7','anti-malware'),('cis-v8/10.1','anti-malware'),
-- data lifecycle cluster
('soc2-2017/P4.2','data-retention'),('sg-pdpa/OB-RETENTION','data-retention'),('soc2-2017/C1.1','data-classification'),('sg-pdpa/OB-PURPOSE','data-classification');
