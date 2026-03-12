# TICKET-003 — Sundled Commercial Layer

> **Tipo**: PRP / Ticket ejecutable  
> **Prioridad**: Alta  
> **Estado**: Ready for Claude Code  
> **Fecha**: 2026-03-08  
> **Stack obligatorio**: Next.js + TypeScript + Supabase + Tailwind + shadcn/ui + Zod + Zustand + pnpm  
> **Referencias base**:  
> - `docs/context/sundled-master-spec.md`  
> - `docs/prp/ticket-001a-sundled-foundation-mvp.md`  
> - `docs/prp/ticket-002-sundled-analytics-layer.md`

---

## 1) Contexto

`TICKET-001A` deja la base operacional: auth, multi-tenant, onboarding de planta, ingestión manual y dashboard mínimo.

`TICKET-002` convierte esa base en una herramienta analítica real: snapshots derivados, comparación consistente, navegación temporal y heatmap utilizable.

Este ticket agrega la **capa comercial** para que Sundled deje de ser solo una aplicación técnica y pase a ser un **SaaS operable y vendible**.

La meta de esta fase es que un workspace pueda:

1. gestionar su organización y miembros,
2. contratar un plan,
3. entender su uso y límites,
4. quedar gobernado por cuotas y feature flags,
5. administrar su suscripción,
6. operar bajo estados comerciales claros.

Este ticket **no** reabre la capa analítica ni intenta construir la plataforma enterprise completa. Debe dejar el producto listo para vender y administrar de manera simple.

---

## 2) Dependencias explícitas

Este ticket **depende** de que `TICKET-001A` y `TICKET-002` ya estén implementados y estables.

Precondiciones mínimas:
- auth + RLS funcionando,
- organizaciones y membresías base operativas,
- plantas y strings ya onboardeables,
- snapshots analíticos y heatmap ya disponibles,
- navegación entre organizaciones/planta ya estable.

Si existe conflicto entre este ticket y el `sundled-master-spec.md`, **manda este ticket para esta fase**.

---

## 3) Problema a Resolver

Hoy la app puede ser útil técnicamente, pero todavía no tiene una capa comercial consistente.

Faltan piezas críticas para operar como SaaS:

1. no existen planes aplicables al producto,
2. no hay control claro de cuota por strings o retención por plan,
3. no existe flujo de activación comercial ni checkout,
4. la gestión de equipo es incompleta,
5. no hay estado visible de trial, suscripción, plan y uso,
6. no existe enforcement consistente cuando una org supera límites.

Sin eso, Sundled puede funcionar como demo o piloto, pero no como producto comercializable y gobernable.

---

## 4) Usuario Objetivo y Job To Be Done

### Usuario objetivo principal
Owner/admin de una organización cliente.

### Usuario secundario
Equipo interno de Sundled que necesita habilitar, observar y soportar cuentas cliente sin tocar SQL manual para casos normales.

### Job to be done
“Cuando decido usar Sundled como producto para mi operación, necesito crear o administrar mi workspace, sumar a mi equipo, entender qué plan tengo, qué límites aplican y cómo pagar o actualizar mi suscripción, para usar el producto sin fricción comercial ni incertidumbre.”

### Resultado medible esperado
- Una organización puede ver y entender su plan actual.
- Un owner/admin puede invitar miembros y gestionar roles permitidos.
- Un owner/admin puede iniciar checkout y volver desde Stripe con estado coherente.
- El sistema aplica límites reales sobre cuota y features.
- El producto bloquea correctamente acciones no permitidas por plan o rol.

---

## 5) Decisiones de Producto para esta Fase

### Decisión 1 — Modelo comercial
El modelo base de Sundled será **por cantidad de strings activos contratados** por organización.

### Decisión 2 — Planes iniciales
Implementar 3 planes semilla:
- `starter`
- `professional`
- `enterprise`

### Decisión 3 — Activación comercial
Implementar flujo de:
- trial inicial,
- upgrade a plan pagado vía Stripe Checkout,
- gestión posterior vía Stripe Billing Portal.

### Decisión 4 — Enforcement
Aplicar enforcement simple y claro:
- si la org supera cuota, no puede activar nuevos strings/plantas que incrementen uso,
- si el plan no incluye una feature, la UI la muestra bloqueada o con CTA de upgrade,
- si la suscripción queda en estado no operativo, se limita el acceso según regla definida abajo.

### Decisión 5 — Suspensión comercial
Para esta fase, el comportamiento será:
- `trialing` y `active`: operación normal,
- `past_due`: se mantiene lectura del producto, pero se bloquean acciones de expansión comercial,
- `canceled` o `unpaid`: acceso de lectura restringida al workspace + CTA de reactivación,
- no borrar datos automáticamente.

### Decisión 6 — Equipo
Los roles comerciales operativos serán:
- `owner`
- `admin`
- `operator`
- `viewer`

Solo `owner` y `admin` pueden gestionar plan, billing e invitaciones.

---

## 6) Alcance del Ticket

### Sí incluye

#### Feature: plans
- Tabla `plans` con seed inicial
- Catálogo de planes visible en UI
- Representación clara de features por plan
- Vinculación del plan actual con la organización

#### Feature: subscriptions
- Tabla y modelo de `subscriptions`
- Integración con Stripe Checkout
- Integración con Stripe Billing Portal
- Webhook Stripe para sincronizar estado de suscripción
- Pantalla de billing en settings

#### Feature: quotas-and-usage
- Cálculo de `string_used`
- Cálculo y exposición de `string_quota`
- Bloqueo de operaciones que aumenten uso sobre cuota
- Vista de uso actual y capacidad restante
- Mensajería clara de límite alcanzado

#### Feature: entitlements
- Feature flags por plan
- Gating server-side y UI-side de capacidades
- Política mínima de retención histórica por plan
- Gating para features premium existentes o futuras

#### Feature: org-settings
- Pantalla de organización
- Editar nombre, slug controlado y billing email
- Ver estado comercial actual
- Mostrar owner principal y metadata útil del workspace

#### Feature: team-management
- Listado de miembros
- Invitar miembro por email
- Aceptar invitación
- Cambiar rol permitido
- Revocar invitación pendiente
- Remover miembro

#### Feature: workspace-switching
- Selector de organización si un usuario pertenece a múltiples orgs
- Persistencia simple de org activa
- Respeto total de RLS y contexto activo

#### Feature: audit-commercial
- Registrar eventos críticos comerciales:
  - invitación creada,
  - invitación aceptada,
  - rol modificado,
  - miembro removido,
  - checkout iniciado,
  - suscripción actualizada,
  - billing portal iniciado,
  - cuota excedida.

### No incluye en este ticket
- SSO / SAML / SCIM
- Facturación anual compleja
- Descuentos, coupons o promociones avanzadas
- Multi-moneda
- Impuestos, VAT o facturación fiscal avanzada
- Overage billing automático
- Seat-based billing
- API pública / API keys
- White-label
- Contratos enterprise custom
- CRM interno
- Flujos de ventas outbound
- Alertas comerciales por WhatsApp/SMS
- Automatizaciones backoffice complejas

---

## 7) Supuestos explícitos

- Stripe será el proveedor de billing para esta fase.
- El plan se asociará a la organización, no a cada planta.
- La unidad comercial base será `strings activos`.
- `string_used` se calcula sobre strings activos/configurados de la organización según regla cerrada abajo.
- El trial inicial será de **14 días**.
- La activación y gestión comercial se resuelven dentro del producto, sin intervención manual para el flujo estándar.
- `enterprise` puede mostrarse como plan disponible aunque ciertos detalles comerciales sigan siendo “contact sales”.

---

## 8) Regla cerrada de negocio

### 8.1 Qué cuenta como `string_used`
Para esta fase, `string_used` debe calcularse como:

> cantidad de `dim_trackers.string_id` activos y válidos asociados a plantas activas de la organización.

Reglas:
- no contar duplicados,
- no contar strings archivados/inactivos,
- no contar registros huérfanos o inválidos,
- recalcular al terminar onboarding válido de planta y ante cambios estructurales relevantes.

### 8.2 Qué acciones consumen cuota
Consumir cuota ocurre cuando:
- una nueva planta queda onboardeada con strings válidos,
- se reemplaza Trackers.csv y aumenta el total de strings activos,
- se reactiva una planta archivada con strings contabilizables.

### 8.3 Qué acciones deben bloquearse por cuota
Bloquear cuando la operación eleva `string_used` por encima de `string_quota`:
- finalizar onboarding de nueva planta,
- subir un nuevo Trackers.csv que incrementa strings,
- reactivar planta archivada,
- cualquier acción futura que aumente el total de strings activos.

### 8.4 Qué no debe bloquearse por cuota
- login,
- lectura del dashboard,
- lectura del heatmap,
- lectura histórica existente,
- descarga de datos ya disponibles,
- desactivar/archivear plantas.

### 8.5 Retención histórica por plan
Para esta fase implementar política simple:
- `starter`: 30 días
- `professional`: 90 días
- `enterprise`: 365 días

La base de datos no necesita borrar datos aún. El gating inicial puede ser **de lectura**.

Regla:
- la UI y las consultas server-side no deben exponer datos fuera de la ventana de retención del plan actual,
- dejar el dato intacto para futuras migraciones de plan.

### 8.6 Features por plan
Seed inicial sugerido:

- `starter`
  - history_days: 30
  - max_team_members: 2
  - analytics_advanced: false
  - billing_portal: true
  - multi_plant_compare: false

- `professional`
  - history_days: 90
  - max_team_members: 10
  - analytics_advanced: true
  - billing_portal: true
  - multi_plant_compare: true

- `enterprise`
  - history_days: 365
  - max_team_members: -1
  - analytics_advanced: true
  - billing_portal: true
  - multi_plant_compare: true

No inventar más flags de los necesarios. Solo las que ya puedan ser usadas por el producto actual o cercano.

---

## 9) Diseño de Producto

### 9.1 Rutas esperadas

```txt
/(app)
  /settings/organization
  /settings/team
  /settings/billing
  /settings/plans
  /accept-invite/[token]
```

Si la arquitectura actual ya usa otro layout de settings, respetarlo, pero mantener estas capacidades.

### 9.2 Flows principales

#### Flow 1 — Ver plan y uso
1. Owner/admin entra a Billing o Plans.
2. Ve plan actual, estado de suscripción, trial restante, strings usados y cuota.
3. Ve CTA contextual: upgrade, manage billing o contact sales.

#### Flow 2 — Upgrade vía Stripe
1. Owner/admin abre planes.
2. Selecciona plan elegible.
3. Click en “Upgrade”.
4. El sistema crea Stripe Checkout Session server-side.
5. Usuario completa flujo en Stripe.
6. Webhook actualiza estado local.
7. Usuario vuelve a la app y ve plan nuevo sincronizado.

#### Flow 3 — Billing portal
1. Owner/admin abre billing.
2. Click en “Administrar suscripción”.
3. Se crea sesión de portal.
4. Usuario gestiona método de pago/cancelación desde Stripe.
5. Webhook refleja cambios en la app.

#### Flow 4 — Invitar miembro
1. Owner/admin entra a Team.
2. Ingresa email y rol.
3. El sistema valida límite de miembros según plan.
4. Se crea invitación.
5. Se envía email con link de aceptación.
6. El usuario acepta invitación y queda incorporado a la org.

#### Flow 5 — Cambio de rol o remoción
1. Owner/admin abre listado de miembros.
2. Cambia rol o remueve miembro.
3. El sistema valida restricciones de seguridad.
4. Se actualiza membresía y se registra auditoría.

#### Flow 6 — Cuota excedida
1. Usuario intenta onboardear planta o aumentar strings.
2. El sistema detecta que excede cuota.
3. Bloquea la acción antes de persistir el cambio final.
4. Muestra mensaje con uso actual, cuota y CTA de upgrade.

### 9.3 Estados y edge cases

#### Empty states
- Sin miembros adicionales: “Invita a tu equipo para colaborar.”
- Sin suscripción pagada: mostrar estado trial + CTA de upgrade.
- Sin método de pago: CTA a checkout o billing portal según corresponda.

#### Loading
- Skeletons en Team/Billing/Plans.
- Estado pending al volver desde Stripe mientras webhook termina de sincronizar.

#### Error
- Webhook Stripe inválido o firma incorrecta.
- Email de invitación no enviado.
- Token de invitación vencido o inválido.
- Usuario intenta aceptar invitación con sesión distinta al email invitado.
- Límite de miembros alcanzado.
- Cambio de plan no permitido.

#### Permisos
- `viewer`: solo lectura básica del workspace; sin settings sensibles.
- `operator`: lectura operativa; sin billing ni team.
- `admin`: team + org settings + billing.
- `owner`: todo lo anterior + acciones críticas irreversibles.

### 9.4 Copy UX mínimo
- “Estás usando {string_used} de {string_quota} strings.”
- “Este cambio supera la cuota de tu plan actual.”
- “Actualiza tu plan para seguir agregando strings.”
- “Tu trial finaliza en {n} días.”
- “Tu suscripción está activa.”
- “Tu suscripción presenta un problema de pago.”
- “Tu acceso está limitado hasta reactivar la suscripción.”
- “Invitación enviada correctamente.”
- “El enlace de invitación es inválido o expiró.”
- “No tienes permisos para administrar billing.”

---

## 10) Diseño Técnico (Golden Path)

### 10.1 Decisión de arquitectura

La capa comercial debe resolver su lógica crítica **server-side**.

Reglas:
- Checkout Session y Billing Portal Session solo desde Server Actions o Route Handlers server-side.
- Webhooks Stripe procesados server-side con verificación de firma.
- Entitlements y cuotas validados server-side antes de mutaciones críticas.
- La UI nunca debe ser la única barrera de permiso o plan.

### 10.2 Estructura Feature-First esperada

```txt
src/
  app/
    (app)/
      settings/organization/page.tsx
      settings/team/page.tsx
      settings/billing/page.tsx
      settings/plans/page.tsx
      accept-invite/[token]/page.tsx

  features/
    billing/
      actions/
      components/
      lib/
      schemas/
      services/
      types/

    organizations/
      actions/
      components/
      schemas/
      services/
      types/

    team/
      actions/
      components/
      schemas/
      services/
      types/

    entitlements/
      lib/
      services/
      types/

  shared/
    lib/
    components/
    types/
```

### 10.3 Modelo de datos conceptual

#### `plans`
Campos mínimos:
- `id`
- `code` (`starter`, `professional`, `enterprise`)
- `name`
- `is_active`
- `price_monthly`
- `currency`
- `string_quota`
- `features_json`
- `created_at`
- `updated_at`

#### `subscriptions`
Campos mínimos:
- `id`
- `org_id`
- `plan_id`
- `provider` (`stripe`)
- `provider_customer_id`
- `provider_subscription_id`
- `provider_price_id`
- `status` (`trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete`)
- `trial_ends_at`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `created_at`
- `updated_at`

#### `org_invitations`
Campos mínimos:
- `id`
- `org_id`
- `email`
- `role`
- `token_hash`
- `invited_by_user_id`
- `status` (`pending`, `accepted`, `revoked`, `expired`)
- `expires_at`
- `accepted_at`
- `created_at`
- `updated_at`

#### `commercial_events`
Campos mínimos:
- `id`
- `org_id`
- `actor_user_id` nullable
- `event_type`
- `entity_type`
- `entity_id`
- `payload_json`
- `created_at`

#### Ajustes en `organizations`
Agregar o normalizar según necesidad:
- `slug`
- `billing_email`
- `owner_user_id` si aporta claridad operacional
- `current_subscription_id` opcional si realmente simplifica lectura
- `string_used`
- `string_quota`
- `commercial_status` derivable o persistido solo si simplifica UI

#### Ajustes en `org_members`
Mantener restricciones:
- un usuario no puede tener membresías duplicadas en la misma org,
- siempre debe existir al menos un `owner`.

### 10.4 Fuente de verdad

Regla cerrada:
- Stripe es fuente de verdad para estado de cobro,
- Postgres es fuente de verdad interna para autorización, entitlements, invitaciones y lectura rápida de estado sincronizado.

### 10.5 Integraciones necesarias

#### Stripe
Necesario implementar:
- customer creation/reuse,
- checkout session creation,
- billing portal session creation,
- webhook endpoint,
- sincronización de customer/subscription/price/status.

#### Resend o proveedor de email ya elegido
Necesario para:
- enviar invitación de team,
- reenviar invitación si sigue vigente.

No introducir un segundo proveedor si ya existe una convención de email en el proyecto.

---

## 11) Seguridad y RLS

### 11.1 Reglas de acceso

Todas las tablas nuevas o modificadas deben quedar con RLS activa desde la misma migración.

#### `plans`
- lectura autenticada permitida si `is_active = true`
- escritura solo service role / admin interno si existiera

#### `subscriptions`
- lectura solo miembros de la org correspondiente
- mutaciones manuales denegadas a usuarios comunes
- cambios solo por server-side trusted path / webhook sync

#### `org_invitations`
- lectura solo owner/admin de la org
- creación solo owner/admin
- aceptación solo por flujo server-side validado por token y sesión
- no exponer tokens raw en lectura normal

#### `commercial_events`
- lectura solo owner/admin de la org, o incluso solo owner si quieres minimizar superficie
- escritura solo trusted server path

### 11.2 Restricciones de seguridad
- Nunca guardar token de invitación en texto plano; guardar hash.
- Nunca confiar en email del cliente sin verificación server-side.
- Verificar firma del webhook Stripe.
- No permitir que un admin se quite el último owner si deja la org sin owner.
- No permitir que un usuario remueva su propio acceso si es el último owner.
- No permitir que un viewer/operator acceda a billing/team mutando URL.
- No confiar en `string_used` enviado por cliente.

### 11.3 Headers y protección mínima
- mantener security headers ya definidos,
- rate limit en creación de invitaciones,
- rate limit en inicio de checkout/portal,
- rate limit en aceptación de invitaciones por token.

---

## 12) Validaciones Zod y Reglas

### 12.1 Organización
Validar:
- `name` obligatorio
- `billing_email` válido
- `slug` si se edita, restringido y único

### 12.2 Invitaciones
Validar:
- email válido
- rol permitido
- no invitar a alguien ya miembro activo
- no exceder `max_team_members`
- expiración razonable, por ejemplo 7 días

### 12.3 Billing
Validar:
- plan code válido
- transición permitida
- org con contexto correcto
- customer existente o creable

### 12.4 Cuotas
Validar server-side antes de mutaciones que consumen cuota:
- valor recalculado de `string_used`
- cuota vigente del plan actual
- impacto esperado de la operación

### 12.5 Entitlements
Crear helpers claros, por ejemplo:
- `getOrgSubscription(orgId)`
- `getOrgPlan(orgId)`
- `getOrgEntitlements(orgId)`
- `assertPlanAccess(orgId, featureKey)`
- `assertStringQuota(orgId, projectedStringUsed)`
- `assertTeamMemberLimit(orgId, projectedMemberCount)`

No dispersar esta lógica en componentes.

---

## 13) Observabilidad mínima

Registrar al menos:
- webhook recibido,
- webhook procesado con éxito/error,
- checkout iniciado,
- portal iniciado,
- invitación creada,
- invitación aceptada,
- cuota excedida,
- bloqueo por entitlement,
- cambio de rol,
- remoción de miembro.

Necesario para soporte:
- trace mínimo por org,
- mensajes claros de error,
- correlación básica entre evento Stripe y registro local.

---

## 14) Tareas Técnicas (Checklist)

### Fase 0 — Setup comercial
- [ ] Crear feature folders para billing, team, organizations y entitlements
- [ ] Validar variables de entorno Stripe y email en `env.ts`
- [ ] Añadir seeds/migraciones para planes iniciales
- [ ] Definir types compartidos de plan/subscription/invitation

### Fase 1 — Modelo de datos y RLS
- [ ] Crear/ajustar tablas `plans`, `subscriptions`, `org_invitations`, `commercial_events`
- [ ] Ajustar `organizations` para `string_used`, `string_quota`, `billing_email` u otros campos mínimos
- [ ] Añadir índices necesarios
- [ ] Implementar RLS completa desde migración
- [ ] Agregar constraints para roles, unicidad e integridad de owner

### Fase 2 — Entitlements y cuotas
- [ ] Implementar servicio central de plan/entitlements
- [ ] Implementar cálculo de `string_used`
- [ ] Implementar enforcement de `string_quota`
- [ ] Implementar enforcement de `history_days`
- [ ] Implementar enforcement de `max_team_members`
- [ ] Integrar gating en features existentes donde corresponda

### Fase 3 — Team management
- [ ] Construir página Team
- [ ] Listar miembros actuales
- [ ] Crear invitación por email
- [ ] Enviar email de invitación
- [ ] Implementar aceptación de invitación
- [ ] Implementar cambio de rol
- [ ] Implementar remoción de miembro
- [ ] Implementar revocación/reenvío de invitación

### Fase 4 — Billing y Stripe
- [ ] Construir página Plans
- [ ] Construir página Billing
- [ ] Crear Stripe customer/reuse
- [ ] Crear Checkout Session
- [ ] Crear Billing Portal Session
- [ ] Implementar endpoint o route handler de webhook
- [ ] Sincronizar estado de suscripción local
- [ ] Mostrar trial, plan, estado y próxima renovación

### Fase 5 — Organization settings y selector de workspace
- [ ] Construir Organization settings
- [ ] Permitir editar nombre y billing email
- [ ] Implementar workspace switcher para usuarios multi-org
- [ ] Persistir org activa de forma segura

### Fase 6 — UI polish y soporte comercial
- [ ] Mensajería contextual de límites y upgrade
- [ ] Empty states y error states
- [ ] Audit trail mínimo visible o al menos accesible internamente
- [ ] Documentar decisiones y blindajes del flujo comercial

---

## 15) Criterios de Aceptación

### Casos felices
- [ ] Un owner/admin puede ver plan actual, trial restante, cuota y strings usados.
- [ ] Un owner/admin puede abrir checkout para cambiar a un plan pagado.
- [ ] Al completar Stripe Checkout, la app refleja el nuevo estado de suscripción sin edición manual en DB.
- [ ] Un owner/admin puede abrir Billing Portal.
- [ ] Un owner/admin puede invitar un miembro y ese miembro puede aceptar la invitación.
- [ ] Un owner/admin puede cambiar el rol de un miembro dentro de las reglas definidas.
- [ ] El sistema bloquea un onboarding o cambio estructural si excede `string_quota`.
- [ ] El sistema limita la lectura histórica según `history_days` del plan.
- [ ] Un usuario con membresía en varias organizaciones puede cambiar de workspace sin fuga de datos.

### Casos borde obligatorios
- [ ] No se puede invitar a un email que ya es miembro activo de la org.
- [ ] No se puede superar `max_team_members` del plan.
- [ ] No se puede remover al último `owner`.
- [ ] Un `viewer` u `operator` no puede iniciar checkout ni editar team settings.
- [ ] Un token de invitación expirado o revocado no puede aceptarse.
- [ ] Un webhook con firma inválida se rechaza.
- [ ] Si Stripe está momentáneamente desincronizado, la UI no debe inventar un estado falso; debe mostrar estado pendiente o último estado válido.
- [ ] Si la org está `past_due`, puede seguir leyendo pero no aumentar uso.
- [ ] Si la org está `canceled` o `unpaid`, la app aplica el modo restringido definido y ofrece reactivación.

---

## 16) Plan de Pruebas

### Unit
- helpers de entitlements,
- cálculo de `string_used`,
- validaciones de invitación,
- validaciones de rol,
- mapeo de estados Stripe a estados internos.

### Integration
- creación de checkout session,
- creación de portal session,
- procesamiento de webhook,
- aceptación de invitación,
- enforcement de cuota en onboarding/cambio de trackers,
- enforcement de `history_days` en queries analíticas.

### E2E
- owner inicia trial y ve billing state,
- owner hace upgrade por checkout y vuelve a la app,
- owner invita admin/operator/viewer,
- invitado acepta enlace y entra a la org,
- viewer intenta acceder a billing y falla,
- org supera cuota y la UI bloquea acción correctamente.

### Seguridad
- probar RLS de tablas nuevas,
- probar que invitaciones no exponen token raw,
- probar que Stripe webhook rechaza firmas inválidas,
- probar que un usuario de otra org no ve billing/team ajeno.

---

## 17) Riesgos y Blindajes

### Riesgo 1 — Duplicar lógica de plan en muchos lugares
**Blindaje**: centralizar entitlements en un servicio único server-side.

### Riesgo 2 — Confiar en UI para bloquear features
**Blindaje**: todo gating crítico debe verificarse también server-side.

### Riesgo 3 — `string_used` inconsistente
**Blindaje**: definir una sola regla cerrada y recalcular desde tablas fuente, no desde payload cliente.

### Riesgo 4 — Caos de estados Stripe
**Blindaje**: mapa explícito de estados permitidos y UI con fallback a “sincronizando” cuando corresponda.

### Riesgo 5 — Invitaciones inseguras
**Blindaje**: token hasheado, expiración corta, validación de email/sesión y revocación real.

### Riesgo 6 — Sobreconstruir billing enterprise
**Blindaje**: limitar esta fase a mensual simple por strings, sin coupons, sin impuestos avanzados y sin flujos backoffice complejos.

### Riesgo 7 — Dejar a una org sin owner
**Blindaje**: constraint y validación de negocio antes de cambios de rol/remoción.

---

## 18) Plan de Entrega

### Fase 0 — Setup comercial
**Entregable**: estructura base, env y seeds.  
**Validación**: proyecto compila y reconoce configuración comercial.

### Fase 1 — Datos + RLS
**Entregable**: tablas comerciales y reglas de acceso listas.  
**Validación**: RLS y constraints pasando pruebas.

### Fase 2 — Entitlements + quotas
**Entregable**: plan/usage/gating funcionando.  
**Validación**: sistema bloquea correctamente exceso de cuota y retención.

### Fase 3 — Team management
**Entregable**: team page + invitaciones + roles.  
**Validación**: invitación, aceptación y remoción funcionando extremo a extremo.

### Fase 4 — Billing Stripe
**Entregable**: checkout, portal y webhook estables.  
**Validación**: cambio de suscripción sincronizado end-to-end.

### Fase 5 — Polish comercial
**Entregable**: UX clara, estados comerciales consistentes y auditoría mínima.  
**Validación**: owner/admin entiende sin fricción su estado y límites.

---

## 19) Notas de Implementación (convenciones SaaS Factory)

- Mantener enfoque **Feature-First**.
- No crear APIs internas redundantes si una Server Action resuelve el caso.
- Usar Route Handlers solo donde sean necesarios por Stripe webhook o URLs públicas controladas.
- RLS obligatoria en la misma migración.
- `env.ts` obligatorio y tipado.
- Validación Zod en inputs server-side.
- No introducir librerías extra si el stack actual ya cubre el caso.
- No mezclar billing comercial con analítica avanzada nueva.
- Todo cambio crítico debe quedar documentado en el ticket o en auto-blindaje del repo.

---

## 20) PRP/Ticket para Claude Code

### Título
Implementar **Commercial Layer** en Sundled sobre la base ya existente de Foundation MVP y Analytics Layer.

### Contexto
Existe un producto ya funcional a nivel técnico y analítico, pero aún no está listo para operar como SaaS comercial. Falta resolver planes, suscripciones, cuotas, team management y feature gating. La referencia amplia es `docs/context/sundled-master-spec.md`, pero para esta fase manda este ticket.

### Objetivo
Dejar Sundled listo para operar como producto comercial básico, con:
- planes,
- trial,
- checkout Stripe,
- billing portal,
- team management,
- cuotas por strings,
- gating por plan,
- selector de workspace,
- auditoría comercial mínima.

### Alcance
Implementar:
- `plans`,
- `subscriptions`,
- `org_invitations`,
- `commercial_events`,
- billing pages,
- team pages,
- org settings,
- Stripe checkout + portal + webhook,
- team invitation flow,
- quota enforcement,
- retention gating,
- entitlements centralizados.

### No alcance
No implementar:
- SSO,
- impuestos complejos,
- coupons,
- multi-moneda,
- white-label,
- API pública,
- overage auto-billing,
- contratos enterprise custom,
- automatizaciones comerciales complejas.

### UX / Flows
Implementar estas experiencias:
1. owner/admin ve su plan, trial, estado y uso,
2. owner/admin puede hacer upgrade vía Stripe,
3. owner/admin puede abrir billing portal,
4. owner/admin puede invitar equipo y cambiar roles,
5. el sistema bloquea acciones que exceden cuota,
6. el producto restringe lectura/expansión según estado comercial.

### Modelo de datos
Crear o ajustar como mínimo:
- `plans`,
- `subscriptions`,
- `org_invitations`,
- `commercial_events`,
- `organizations` con campos comerciales mínimos.

### Seguridad / RLS
- RLS activa en todas las tablas nuevas.
- `plans`: lectura autenticada de planes activos.
- `subscriptions`: lectura solo miembros org; mutación solo trusted server path.
- `org_invitations`: creación/lectura solo owner/admin; aceptación vía token server-side.
- `commercial_events`: escritura solo trusted path.
- tokens de invitación hasheados.
- firma Stripe obligatoria.

### Validaciones
- Zod para org settings, team invites y billing actions.
- Helpers server-side centralizados para:
  - `getOrgEntitlements`,
  - `assertPlanAccess`,
  - `assertStringQuota`,
  - `assertTeamMemberLimit`.

### Tareas técnicas
1. crear migraciones y seeds,
2. implementar RLS y constraints,
3. implementar servicio central de entitlements,
4. implementar cálculo de `string_used`,
5. implementar team management,
6. implementar Stripe checkout/portal/webhook,
7. implementar páginas de settings/plans/billing/team,
8. integrar gating y mensajería,
9. cubrir unit/integration/e2e críticas.

### Criterios de aceptación
- owner/admin puede ver y administrar plan,
- upgrade Stripe sincroniza estado local,
- billing portal abre correctamente,
- invitación y aceptación funcionan,
- límite de miembros y cuota de strings se aplican,
- lectura histórica se restringe por plan,
- viewer/operator no acceden a billing/team sensible,
- multi-org switcher funciona sin fuga de datos.

### Plan de pruebas
- unit para entitlements y cálculo de cuota,
- integration para billing/invitations,
- e2e para upgrade, invitation flow, access control y quota enforcement,
- pruebas de RLS y webhook signature.

### Notas de implementación
Seguir Golden Path estricto, Feature-First, pnpm, Server Actions cuando aplique, Route Handlers solo para Stripe/webhook y aceptación pública controlada. No sobreconstruir. Esta fase debe dejar el producto vendible y gobernable, no resolver todas las necesidades enterprise.
