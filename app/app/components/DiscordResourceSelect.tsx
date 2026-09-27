type DiscordResourceOption = {
  id: string;
  label: string;
};

type Props = {
  name: string;
  currentValue: string;
  emptyLabel: string;
  options: DiscordResourceOption[];
};

export default function DiscordResourceSelect({ name, currentValue, emptyLabel, options }: Props) {
  const currentIsAvailable = options.some((option) => option.id === currentValue);
  return (
    <select name={name} defaultValue={currentValue}>
      <option value="">{emptyLabel}</option>
      {currentValue && !currentIsAvailable ? (
        <option value={currentValue}>Previously saved selection ({currentValue})</option>
      ) : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}
