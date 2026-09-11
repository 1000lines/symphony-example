# CT-A adoption evidence

This September 11, 2026 checkpoint records the available inputs for
[100-58](https://linear.app/1000lines/issue/100-58). Adoption and live consumer
proof remain open. The [consumer census](consumer-census.md) records the paths
that must survive or receive a proven replacement.

## Inspected revisions

| Repository                            | Inspected ref                      | Commit                                     |
| ------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `1000lines/symphony-example`          | Selected branch and PR base `main` | `e362e5ad76fa8070ef27bf54fec9d6750195466c` |
| `1000lines/symphony-client-template`  | Public `main` and `alpha`          | `58021a73ac3a6c2141a1217fc88c27e590df8143` |
| `1000lines/symphony-client-workflows` | Public `main` and `alpha`          | `77cfb2d1f4e0e488af207096b1785b63ffc0398b` |

`git ls-remote` returned both branch refs and no `refs/tags/alpha` in either
publication repository. Read-only checkouts at those commits supplied the
comparisons below. These observations identify the initial published subset;
they do not identify a final migrated pair or a consumed live workflow commit.

Jeremy's publication decisions in [100-55](https://linear.app/1000lines/issue/100-55)
and [100-56](https://linear.app/1000lines/issue/100-56) accept that subset and
defer unfinished functionality. Their Done states remain accepted. The
[accepted CT-A contract](delivery-items.md#ct-a--adopt-published-template-and-prove-live-consumer-paths)
still requires CT-F's published migration and CT-O's actual skill for the
dependent adoption and walkthrough.

| Input          | Observed artifact                                                                                                                                                                                                                                             | Remaining handoff                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CT-F / 100-57  | [Template PR #10](https://github.com/1000lines/symphony-client-template/pull/10) is an open draft at `544d4395f2a27d9096e1780f6d42a81d762ddfd0`, based on `main`. Public alpha still calls seed CI/wakeup code at `fd383f5760a2ba62ea6f6295bd6dd21cc0cb9e9e`. | CT-F owns human-reviewed merge, template alpha advancement and template-root migrated-run evidence.                                                                                                                        |
| CT-O / 100-54  | [Seed PR #49](https://github.com/1000lines/symphony-example/pull/49) merged the walkthrough dependency note. Its directory contains no `SKILL.md`, `references/fork.md` or `references/direct.md`.                                                            | The owner-controlled walkthrough needs a delivered onboarding entry point and procedures. Preserve the accepted terminal issue state.                                                                                      |
| Review callers | Public template has 23 source output paths; review, handoff and review-cleanup callers are absent. Published workflow provenance records deferred provider files.                                                                                             | [100-64](https://linear.app/1000lines/issue/100-64) owns the separately commissioned provider/caller work in the publication repositories. Consume accepted artifacts through Copier; do not import its unmerged branches. |

The September 11 [reviewer-choice decision](https://github.com/1000lines/symphony-example/pull/42#discussion_r3991277811)
and [client-skill correction](https://github.com/1000lines/symphony-example/pull/44#issuecomment-5638514034)
remain part of this issue's acceptance. There are eight nonsecret answers,
including required `cadence_reviewer: claude|codex` with no default; the selected
provider needs its matching key, including when both keys are present. Final
integration must verify the accepted exported interface and both provider/key
matrices before claiming this behavior.

## Fourteen existing client resource collisions

All fourteen added destinations in [client-copy.txt](client-copy.txt) exist in
the selected seed base. Comparison with `template/<same path>` at the public
template commit above found six identical files and eight differences. These
resources are plain copied files, not Jinja sources. The table records Git blob
prefixes; full objects are recoverable from the named repository commits.

| Client-relative path                                                                      | Seed blob      | Published blob | Reconciliation after final render        |
| ----------------------------------------------------------------------------------------- | -------------- | -------------- | ---------------------------------------- |
| `.agents/skills/symphony-project-factory/SKILL.md`                                        | `4da117470d40` | `563869c9e8c8` | Use reviewed external-tooling references |
| `.agents/skills/symphony-project-factory/templates/project-description.md`                | `41362ea82607` | `41362ea82607` | Preserve identical bytes                 |
| `.agents/skills/symphony-project-factory/templates/tickets/requirements-and-design.md`    | `cd30f0d8406d` | `452173fc0ab1` | Use reviewed external-tooling references |
| `.agents/skills/symphony-project-factory/templates/tickets/plan-project.md`               | `6cc331fd8c7e` | `1155e206387b` | Use reviewed external-tooling references |
| `.agents/skills/symphony-project-factory/templates/tickets/trigger-fan-out.md`            | `bb12b17db6ee` | `e5410e38055f` | Use reviewed external-tooling references |
| `.agents/skills/symphony-project-factory/templates/tickets/broaden-fanout-integration.md` | `5cc03e601520` | `1415a606050c` | Use reviewed external-tooling references |
| `.agents/skills/symphony-project-factory/templates/tickets/standup.md`                    | `79c962720d54` | `484a4ce457ee` | Use reviewed external-tooling references |
| `.agents/skills/linear-graphql/SKILL.md`                                                  | `9e78011f5f70` | `68eba4531b27` | Use reviewed external-tooling references |
| `.agents/skills/linear-graphql/agents/openai.yaml`                                        | `aad71dde5bd5` | `aad71dde5bd5` | Preserve identical bytes                 |
| `.agents/skills/linear-graphql/scripts/linear-graphql.mjs`                                | `02dea49a05f7` | `02dea49a05f7` | Preserve identical bytes                 |
| `scripts/symphony/runtime-bundle/skills/symphony-replan/SKILL.md`                         | `c39064afb3ae` | `6ab64db29078` | Use client-local replan guide            |
| `docs/engineering/symphony/replanning.md`                                                 | `0913ba0a92bc` | `0913ba0a92bc` | Preserve identical bytes                 |
| `.agents/skills/karpathy-guidelines/SKILL.md`                                             | `128a16df1169` | `128a16df1169` | Preserve identical bytes                 |
| `.agents/skills/karpathy-guidelines/EXAMPLES.md`                                          | `43d8f77dc3d0` | `43d8f77dc3d0` | Preserve identical bytes                 |

The seven external-tooling changes prefix existing helper/guide references with
`$SYMPHONY_TOOLING_ROOT`; the replan change selects the client-local
`docs/engineering/symphony/replanning.md`. The proposed reconciliation is to
preserve the six identical files and apply only those reviewed path changes
after comparison against CT-F's final published tree. Retain factory templates,
Linear metadata/helper, the nested replan guide, Karpathy's MIT declaration and
attribution. No collision has been overwritten by this checkpoint.

The later isolated render must also reconcile `.symphony.cfg.json`,
`.gitattributes` and ingress, and create the reviewed instructions, App manifest,
answers and callers. Preserve setup/lint commands and actual required checks;
add `SYMPHONY.md` to existing instructions explicitly. Preserve application and
tooling hashes, README/LICENSE/NOTICE and manual workflows. Remove staging and
its test workflow only after successful extraction and isolated adoption, with
the corresponding required-check configuration handled in the same review.

## Installed reader observation

The reader loaded by this worker resolves to runtime bundle release
`a3b7428a9e0298592e119a57923854b75a9b61a0`, at
`skills/symphony-repository/scripts/config.mjs`. Its SHA-256 is
`193919f7102a82095919123f455214bc6fbe75793cb540fdf94f8989a888777f`.
Calling its existing `validateConfig` accepts the seed config with omitted mode,
but rejects each explicit `native`, `docker` and `remote` mode with
`Unknown or invalid configuration fields`. The selected seed base's reviewed
reader accepts all four cases.

This is an installed-file and callable-reader observation, not a service reload
or end-to-end validation-mode result. Jeremy owns updating the installed bundle
through its reviewed rollout path and reading back the loaded revision plus
successful mode validation before explicit-mode activation. This checkpoint
does not request wider App permissions or change the host.

Repository required checks at the selected base are `CI Required` from
`.github/workflows/ci.yml` and `Client template tests` from
`.github/workflows/client-template-test.yml`, both GitHub Actions App `15368`.
`Cadence review` is excluded. The runtime's Symphony App (`4866508`) received
HTTP 403 `Resource not accessible by integration` from
`GET repos/1000lines/symphony-example/branches/main/protection/required_status_checks`.
Before activation, Jeremy should read back the effective required checks using
repository Administration read access; the committed config alone does not
establish branch-protection settings. No administrative write was attempted.

## Evidence still required for adoption

| Acceptance                         | Required evidence and owner                                                                                                                                                                                                                                                                   | Status at this checkpoint                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Published adoption                 | CT-A runs `copier copy --vcs-ref=alpha https://github.com/1000lines/symphony-client-template.git <isolated-checkout>` with the eight answers. Record ordinary `_src_path`/`_commit`, actual template SHA, collision decisions and unrelated-file preservation.                                | Waiting on CT-F's accepted publication; no final render or staging deletion.                                  |
| Final review and readiness         | After Jeremy merges trusted callers, a separate 100-58 proof PR records actual workflow/helper SHAs, run/attempt, Codex and App identity, review/check IDs, queued/running to linked result, draft to ready and fresh feedback closure.                                                       | Not executed. Current native Claude evidence cannot satisfy this row.                                         |
| Cleanup and provider compatibility | Match the cleanup listener to actual generated workflow names, prove canceled/failed review recovery, and test both explicit selections with matching/both/other-only/neither keys at the final export. Run real Claude smoke if its execution boundary changes beyond prior tested behavior. | Waiting on published callers; fixtures cannot prove live provider execution.                                  |
| Validation modes                   | Native build/lint/tests; separate client-Dockerfile demonstration with image digest; remote missing-toolchain proof with failing then corrected current-head CI and actual Active/Inactive plus wake-label readbacks on this task's isolated proof PR.                                        | No mode execution or CI failure rehearsal claimed.                                                            |
| Onboarding and loading             | Jeremy records installed onboarding ref/command, client-local factory/Linear/replan loading, retained resources/licenses, separate reviewed tooling ref, actual App grants and secret names; fork/direct/repeat/additional-project and two-project procedures.                                | No installation, invocation or secret delivery claimed. Project-factory stays outside the unattended profile. |

This checkpoint changes only the two dated evidence documents. Its local and
current-head CI results belong in the
[pinned Codex workpad](https://linear.app/1000lines/issue/100-58/adopt-published-template-and-prove-live-consumer-paths#comment-3875cc13)
and task PR. Passing documentation checks cannot close the live rows above.
If alpha moves, record the new consumed combination and rerun affected proof.
