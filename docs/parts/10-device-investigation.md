# 10. Device Investigation Service

## 10.1 Purpose

The Device Portal is ThreatLens's proprietary analog to a Defender for Endpoint-style investigation surface (§1.6) — where a Student investigates *what happened on a machine*: process execution, persistence, network activity, and file activity. Backed by `devices` (§6.11) and the device-scoped event tables in §6.12 (`process_events`, `file_events`, `network_events`, `dns_events`, `registry_events`, plus `installed_software`, `device_services`, `startup_entries`, `usb_events`).

## 10.2 Device Overview

Directory list (mirrors §9.2's pattern): hostname, OS platform/version, primary identity, risk level, isolation status, last-seen. Profile overview panel adds: full installed-software inventory (`installed_software`), running-services list (`device_services`), and startup-entries list (`startup_entries`) — the three "what is configured to run on this box" inventories a real endpoint investigation starts from.

## 10.3 Process Tree

The signature investigative view of the Device Portal: `process_events` rows for the device rendered as a navigable tree via `parent_process_guid` self-reference (§6.12.2), each node showing image path, command line, hash, integrity level, and the identity context it ran under. Nodes corresponding to alert-triggering or ground-truth-adjacent activity are not visually distinguished from any other node by default (that would leak the answer) — a Student must expand and read command lines to judge suspiciousness, exactly as in real endpoint tooling. A "search within tree" control lets a Student filter the tree to nodes matching a command-line substring or hash, without collapsing the surrounding structure needed to reason about parent/child relationships.

## 10.4 Network Connections and Open Ports

`network_events` rows for the device, filterable by direction, remote IP/port, and process (cross-linked from a specific process-tree node's "show network activity" action, joining on `process_guid`). "Open ports" is realized as the set of distinct `local_port` values with `direction = inbound` observed for the device within the session window — a derived view over `network_events`, not a separately-modeled point-in-time port-scan table, since the investigative question ("what has this device been listening on / connecting to") is adequately answered by the event history without a redundant live-state model.

## 10.5 File Timeline

`file_events` rows for the device in chronological order, filterable by action type (created/modified/deleted/renamed/encrypted). The `encrypted` action type is used specifically by ransomware-category scenarios (§1.8) to let a Student observe and quantify the blast radius (count and paths of encrypted files, encryption rate over time) directly from the timeline, which also feeds the incident-response containment-timing rubric (§2.20, §12.4 — did the Student isolate the device before or after a meaningful fraction of files were encrypted in the simulated timeline).

## 10.6 Registry Changes

`registry_events` rows, filterable by action and key path, with a dedicated "persistence-relevant" quick filter (a curated list of well-known persistence key-path prefixes — Run/RunOnce keys, Winlogon Shell/Userinit, service ImagePath — matched at query time, not a separate flag column) that also cross-references `startup_entries` so a Student can confirm whether a registry change actually resulted in a live startup entry.

## 10.7 USB Activity

`usb_events` rows (connect/disconnect, device serial, volume label) correlated in the UI (via matching `correlation_id`, §7.2) with any `file_events` involving that volume — directly supporting insider-threat and data-exfiltration scenario categories (§1.8) where USB mass-storage use is the exfiltration vector.

## 10.8 Security Events (Device-Scoped Summary)

A consolidated, cross-table chronological feed (process/file/network/DNS/registry events for this device interleaved by timestamp) is exposed as a single "Device Timeline" tab, functioning as the device-scoped equivalent of §2.9's Global Timeline — useful because real endpoint investigation is rarely confined to one artifact type at a time, and forcing a Student to tab between five separate lists for a single device would work against the investigative flow this feature exists to teach.

## 10.9 Malware History

Derived view: any `file_events`/`process_events` rows whose `hash_sha256` matches a `threat_intel_indicators` row with `reputation = malicious` (§6.15, §2.7), joined and presented as a "known-malicious activity on this device" panel — this is a query-time join, not a separately maintained table, keeping a single source of truth for indicator reputation.

## 10.10 Device Risk

`devices.risk_level` is computed the same way as `identities.risk_level` (§8, §9): a function of how many and how severe the alerts (§6.15) whose `primary_entity_type = 'device'` and `primary_entity_id` match this device are, recomputed by the Alert Engine whenever new alerts are generated for the session. It is a coarse triage signal shown in list/overview views, never a substitute for the Student's own judgment on any individual profile page — no page in the Device Portal states a verdict on the device's behalf.

## 10.11 Isolation Status and the Isolate Action

`isolation_status` (§6.11) is mutated by the Student-initiated "Isolate Device" action (§2.20), recorded as an `investigation_actions` row (`action_type = 'isolate_device'`, §6.13) with a timestamp compared, at scoring time, against the simulated timeline of the attack's progression on that device (§12.4) — isolating early enough to plausibly limit blast radius is a distinct, positively-weighted rubric component from simply identifying that the device was compromised at all, reflecting that real SOC work is graded on response, not just detection.

## 10.12 What Is Never Exposed to the Student

Identical policy to §9.9: `is_ground_truth_actor`, all `is_ground_truth_evidence`/`mitre_technique_id` fields on event rows, and `installed_software.is_known_bad` are stripped at the serialization layer (§18.3) for every Student-facing Device Portal endpoint.
