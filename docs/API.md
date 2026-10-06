# API contract (FROZEN). JSON, CORS enabled.
| Endpoint | Purpose |
|---|---|
| `POST /auth/login` `{email,password}` -> `{token,role,universityId}` | Login |
| `POST /admin/universities/:id/approve` | Approve + mark accredited (admin) |
| `GET /universities` | Public list: id, name, accredited |
| `POST /batches` (multipart CSV, registrar) -> `{batchId,root,txHash,count}` | Issue batch |
| `POST /records/:serial/revoke` `{reason}` (registrar) | Revoke |
| `GET /verify/:universityId/:serial` | Verify by serial / QR |
| `POST /verify/photo` (multipart image) -> `{fields:{reg_no,student_name,award,class_of_award,graduation_year,serial_no,university_name},confidence}` | AI extraction |
| `POST /verify/check` `{universityId,fields}` | Final layered verdict |

CSV columns: `reg_no,student_name,programme,award,class_of_award,graduation_year,serial_no`

## Verify response (all verify endpoints)
```json
{ "status": "verified|mismatch|not_found|revoked|unaccredited",
  "university": {"id":1,"name":"...","accredited":true},
  "revoked": false, "mismatchedFields": ["class_of_award"],
  "txHash": "0x...", "anchoredAt": "ISO date",
  "aiRisk": {"score": 0.1, "notes": "plain-language note"} }
```
