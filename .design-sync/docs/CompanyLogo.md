A company's square: its logo, cropped to fill it, or its initials on its color. Use it for an
organization, in the organization switcher, a list of a member's organizations or the head of a
company's profile. A person is an `Avatar`, and Strategy Dance's own mark is `Logo`.

## Usage

```jsx
const { CompanyLogo } = window.StrategyDanceDesignSystem

const logo = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#fef3c7"/><circle cx="48" cy="48" r="30" fill="#d97706"/></svg>'
)

<div className="flex items-center gap-3">
  <CompanyLogo name="Acme Robotics" size="sm" />
  <CompanyLogo name="Acme Robotics" color="#16A34A" />
  <CompanyLogo name="Northwind Studio" color="#FACC15" size="lg" />
  <CompanyLogo name="Acme Robotics" src={logo} size="xl" />
  <CompanyLogo name="Blue Harbor" color="#142A41" size="2xl" />
</div>
```

Beside the name it stands for, the logo is left out of the accessibility tree with an empty `alt`:

```jsx
const { CompanyLogo } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-2 text-sm font-semibold text-secondary">
  <CompanyLogo name="Acme Robotics" color="#0051A3" alt="" />
  Acme Robotics
</div>
```

## Notes

- `size` is `md`, 32px, unless set: `sm` is 24px, `lg` 40px, `xl` 56px and `2xl` 112px, the last
  for the head of a company's profile. The corners are the xs radius at every size
- The initials come from `name` and are always drawn under the logo, so they show while there is
  no `src` and for good once it fails to load. The logo sits on white, inside a hairline
- `color` is the initials' background as `#RRGGBB`, and the initials turn white or black,
  whichever reads on it. Without one the square is the primary blue with white initials
- `alt` is the accessible name and defaults to `name`. Leave it empty beside the name
- It takes no children. A square of the same size holding something else, such as an "add an
  organization" plus, takes the classes from `companyLogoVariants({ size: 'md' })`
