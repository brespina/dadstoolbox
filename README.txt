Agent break log for the v1 build (spec #15).

This branch is separate from the code on purpose: nothing here is in the
working tree that agents read, so it never ends up in their context.

When an agent takes a break, it writes one file: <date>-<agent>-<topic>.txt
