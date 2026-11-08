The goal of this project is to create an obsidian base view with extremely good UI.

A number of similar plugins exist (e.g. DataLoom) as well as Obsidian's default "base" view, and are installed in the \`Test\` vault, but lack various types of functionalities.

Desired featureset:

- source of database is frontmatter of all documents in a folder.
  - the source selection should have dropdowns as in native obsidian base view, which help select the folder, without needing the user to correctly type a path over (as in DataLoom).
- coloring of list (tag) entries
- datatypes (backward compatible with frontmatter types, and infered unless the user sets it): 
  - "status" which is a mutually exclusive dropdown
  - "number" with progress bar, progress circle, (or just plain number) options
  - "tag" (list) or actual obsidian tags
    - suggestion of old tags, and creation of new tags via search. Assume that tag selection will be huge
  - "multi-tag" (list)
  - "dates" and "times" with options to display as relative to today, or future. And nice calendar select widgets.
- wordwrap or overflow toggle where relevant
- minimalist. Keep margins and padding in UI to minimum
- standard featuers such as dragging and resizing columns on UI, editing column names, editing the original file by clicking on a cell and editing the property, etc. etc. filtering, sorting, selecting which columns to display and in which format, etc.
- not sure how to store the configuration options