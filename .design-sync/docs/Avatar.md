A person's picture in a circle, which shows their initials while the picture loads, when it fails
and when there is none. Use it wherever a member is named: the team's table, a task's assignee,
the user menu. `AvatarGroup` overlaps several, for the members on a task or in a document.

## Usage

```jsx
const { Avatar, AvatarGroup } = window.StrategyDanceDesignSystem

<div className="flex flex-col gap-6">
  <div className="flex items-center gap-3">
    <Avatar name="Maya Laurent" size="sm" />
    <Avatar name="Maya Laurent" />
    <Avatar name="Maya Laurent" size="lg" />
    <Avatar name="Maya Laurent" size="xl" />
  </div>
  <div className="flex items-center gap-2">
    <Avatar src="https://randomuser.me/api/portraits/men/32.jpg" name="Tom Harris" alt="" />
    <span className="text-sm font-medium text-secondary">Tom Harris</span>
  </div>
  <AvatarGroup>
    <Avatar src="https://randomuser.me/api/portraits/men/32.jpg" name="Tom Harris" />
    <Avatar name="Maya Laurent" />
    <Avatar name="Inès Moreau" />
  </AvatarGroup>
</div>
```

A profile's own picture, at its head:

```jsx
const { Avatar } = window.StrategyDanceDesignSystem

<div className="flex flex-col items-center gap-4">
  <Avatar name="Maya Laurent" size="2xl" />
  <h1 className="text-3xl">Maya Laurent</h1>
</div>
```

## Parts

- `AvatarGroup`: a row of Avatars, each overlapping the one before by 12px and ringed in white.
  It has no props of its own, takes a `<div>`'s attributes and `className`, and holds Avatars of
  one size

## Notes

- Not compound: there is no `AvatarImage` or `AvatarFallback`. The picture is `src`, the initials
  come from `name`, and it takes no children
- `size` is `md` unless set: `sm` is 24px, `md` 32px, `lg` 40px, `xl` 56px and `2xl` 128px, for a
  profile's own picture
- The initials are the first letters of the name's first two words, navy on a pale navy circle
- `name` is also the image's alt text and the hover title. Set `alt=""` when the name is written
  right beside the avatar, so a screen reader does not read it twice
