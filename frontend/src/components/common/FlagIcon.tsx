interface FlagIconProps {
  countryCode: string;
  countryName?: string;
  className?: string;
}

export const FlagIcon = ({
  countryCode,
  countryName,
  className = "",
}: FlagIconProps) => {
  const code = countryCode.toLowerCase();

  // Convert country code to regional indicator symbols (emoji flag)
  const getCountryFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  // Special case for unknown countries, show checkered flag
  if (code === "unknown" || code === "" || !code) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-1">
          <span className="text-lg" role="img" aria-label="Checkered flag">
            🏁
          </span>
        </div>
        <span className="text-sm">Unknown</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-1">
        <span className="text-lg" role="img" aria-label={`${countryCode} flag`}>
          {getCountryFlagEmoji(code)}
        </span>
      </div>
      <span className="text-sm">
        {countryName || countryCode.toUpperCase()}
      </span>
    </div>
  );
};
