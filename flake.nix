{
  description = "Scramjet local route proxy";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      denoDeps = pkgs.stdenvNoCC.mkDerivation {
        pname = "snailbet-deno-deps";
        version = "0.1.0";
        src = self;

        nativeBuildInputs = [
          pkgs.deno
        ];

        buildPhase = ''
          runHook preBuild

          export DENO_DIR="$TMPDIR/deno-cache"
          deno cache \
            --vendor=true \
            --config deno.json \
            --lock deno.lock \
            src/server.ts

          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall

          mkdir -p "$out"
          cp -R node_modules "$out/"

          runHook postInstall
        '';

        outputHashAlgo = "sha256";
        outputHashMode = "recursive";
        outputHash = "sha256-cTJsRRxOSb8mZ8i7OFO50gahYylVoa+49T9rkRPDrOc=";
      };
    in {
      packages.${system} = {
        snailbet = pkgs.stdenvNoCC.mkDerivation {
          pname = "snailbet";
          version = "0.1.0";
          src = self;

          nativeBuildInputs = [
            pkgs.makeWrapper
          ];

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/share/snailbet" "$out/bin"
            cp -R deno.json deno.lock src "$out/share/snailbet/"
            cp -R ${denoDeps}/node_modules "$out/share/snailbet/"

            makeWrapper ${pkgs.deno}/bin/deno "$out/bin/snailbet" \
              --add-flags "run" \
              --add-flags "--vendor=true" \
              --add-flags "--node-modules-dir=manual" \
              --add-flags "--config $out/share/snailbet/deno.json" \
              --add-flags "--lock $out/share/snailbet/deno.lock" \
              --add-flags "--allow-net=127.0.0.1,localhost" \
              --add-flags "--allow-env=SCRAMJET_HOST,SCRAMJET_PORT" \
              --add-flags "$out/share/snailbet/src/server.ts"

            runHook postInstall
          '';
        };

        default = self.packages.${system}.snailbet;
      };

      apps.${system}.default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/snailbet";
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.deno
        ];
      };
    };
}
